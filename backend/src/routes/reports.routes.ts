import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { CreateFoundReportRequest, CreateLostReportRequest } from '../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_PREFIX, HttpError } from './route-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaTsPath = path.resolve(__dirname, '../schemas/reports.schema.ts');
const schemaJsPath = path.resolve(__dirname, '../schemas/reports.schema.js');
const serviceTsPath = path.resolve(__dirname, '../services/reports.service.ts');
const serviceJsPath = path.resolve(__dirname, '../services/reports.service.js');

const schemaPath = fs.existsSync(schemaTsPath) ? schemaTsPath : schemaJsPath;
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

const schemaModule = (await import(pathToFileURL(schemaPath).href)) as {
  createLostReportSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: CreateLostReportRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
  createFoundReportSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: CreateFoundReportRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
};
const reportsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  ReportPhotoUploadError: new (
    code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED',
    message: string,
  ) => Error & { code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED' };
  createLostReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateLostReportRequest,
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
  createFoundReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateFoundReportRequest,
    photo: { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' },
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
};

const detectAllowedImageMime = (buffer: Buffer): 'image/jpeg' | 'image/png' | null => {
  const isPng =
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
  if (isPng) {
    return 'image/png';
  }

  const isJpeg =
    buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
  if (isJpeg) {
    return 'image/jpeg';
  }

  return null;
};

export const createReportsRouter = (db: Firestore, bucket: Bucket): Router => {
  const router = Router();
  const createReportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many report submissions. Please try again later.',
      },
    },
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  router.post(`${API_PREFIX}/reports/lost`, createReportLimiter, async (req, res) => {
    const parsed = schemaModule.createLostReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
      throw new HttpError(400, 'BAD_REQUEST', message);
    }

    let result: { id: string; report: { referenceCode: string } };
    try {
      result = await reportsServiceModule.createLostReport(db, bucket, parsed.data);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportPhotoUploadError) {
        if (error.code === 'INVALID_PHOTO_DATA_URL') {
          throw new HttpError(400, 'BAD_REQUEST', error.message);
        }

        throw new HttpError(503, 'PHOTO_UPLOAD_FAILED', error.message);
      }

      throw error;
    }

    res.status(201).json({
      id: result.id,
      referenceCode: result.report.referenceCode,
    });
  });

  router.post(
    `${API_PREFIX}/reports/found`,
    createReportLimiter,
    (req, res, next) => {
      upload.single('photo')(req, res, (error: unknown) => {
        if (!error) {
          next();
          return;
        }

        const message = error instanceof Error ? error.message : 'Invalid upload payload';
        next(new HttpError(400, 'BAD_REQUEST', message));
      });
    },
    async (req, res) => {
      if (!req.file) {
        throw new HttpError(400, 'BAD_REQUEST', 'photo is required');
      }

      const detectedMimeType = detectAllowedImageMime(req.file.buffer);
      if (!detectedMimeType) {
        throw new HttpError(400, 'BAD_REQUEST', 'photo must be a valid JPEG or PNG');
      }

      const payload = {
        ...req.body,
      };

      const parsed = schemaModule.createFoundReportSchema.safeParse(payload);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
        throw new HttpError(400, 'BAD_REQUEST', message);
      }

      let result: { id: string; report: { referenceCode: string } };
      try {
        result = await reportsServiceModule.createFoundReport(db, bucket, parsed.data, {
          buffer: req.file.buffer,
          mimeType: detectedMimeType,
        });
      } catch (error) {
        if (error instanceof reportsServiceModule.ReportPhotoUploadError) {
          if (error.code === 'INVALID_PHOTO_DATA_URL') {
            throw new HttpError(400, 'BAD_REQUEST', error.message);
          }

          throw new HttpError(503, 'PHOTO_UPLOAD_FAILED', error.message);
        }

        throw error;
      }

      res.status(201).json({
        id: result.id,
        referenceCode: result.report.referenceCode,
      });
    },
  );

  return router;
};
