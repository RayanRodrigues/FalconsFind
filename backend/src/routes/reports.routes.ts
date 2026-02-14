import { Router } from 'express';
import multer from 'multer';
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
  createLostReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateLostReportRequest,
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
  createFoundReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateFoundReportRequest,
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
};

export const createReportsRouter = (db: Firestore, bucket: Bucket): Router => {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const isImage = ['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
      if (!isImage) {
        cb(new Error('photo must be JPEG or PNG'));
        return;
      }

      cb(null, true);
    },
  });

  router.post(`${API_PREFIX}/reports/lost`, async (req, res) => {
    const parsed = schemaModule.createLostReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
      throw new HttpError(400, 'BAD_REQUEST', message);
    }

    const result = await reportsServiceModule.createLostReport(db, bucket, parsed.data);
    res.status(201).json({
      id: result.id,
      referenceCode: result.report.referenceCode,
    });
  });

  router.post(`${API_PREFIX}/reports/found`, (req, res, next) => {
    upload.single('photo')(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      const message = error instanceof Error ? error.message : 'Invalid upload payload';
      next(new HttpError(400, 'BAD_REQUEST', message));
    });
  }, async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'BAD_REQUEST', 'photo is required');
    }

    const photoDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const payload = {
      ...req.body,
      photoDataUrl,
    };

    const parsed = schemaModule.createFoundReportSchema.safeParse(payload);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
      throw new HttpError(400, 'BAD_REQUEST', message);
    }

    const result = await reportsServiceModule.createFoundReport(db, bucket, parsed.data);
    res.status(201).json({
      id: result.id,
      referenceCode: result.report.referenceCode,
    });
  });

  return router;
};
