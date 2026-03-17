import { Router } from 'express';
import type { Request } from 'express';
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
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
  listAdminReports: (
    db: Firestore,
    params: {
      page: number;
      limit: number;
      kind?: 'LOST' | 'FOUND';
      status?: string;
      search?: string;
    },
  ) => Promise<{
    reports: unknown[];
    total: number;
    summary: {
      totalReports: number;
      lostReports: number;
      foundReports: number;
      byStatus: Record<string, number>;
    };
  }>;
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const createReportsRouter = (db: Firestore, bucket: Bucket): Router => {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (
      _req: Request,
      file: Express.Multer.File,
      cb: multer.FileFilterCallback,
    ) => {
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

    let result: { id: string; report: { referenceCode: string } };
    try {
      result = await reportsServiceModule.createFoundReport(db, bucket, parsed.data);
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

  router.get(`${API_PREFIX}/admin/reports`, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limitRaw = parsePositiveInt(req.query.limit, 20);
    const limit = Math.min(limitRaw, 100);
    const kindRaw = parseOptionalString(req.query.kind);
    const status = parseOptionalString(req.query.status);
    const search = parseOptionalString(req.query.search);

    const kind = kindRaw === 'LOST' || kindRaw === 'FOUND' ? kindRaw : undefined;
    if (kindRaw && !kind) {
      throw new HttpError(400, 'BAD_REQUEST', 'kind must be LOST or FOUND');
    }

    const result = await reportsServiceModule.listAdminReports(db, {
      page,
      limit,
      kind,
      status,
      search,
    });

    const totalPages = Math.max(1, Math.ceil(result.total / limit));

    res.status(200).json({
      page,
      limit,
      total: result.total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: {
        kind: kind ?? null,
        status: status ?? null,
        search: search ?? null,
      },
      summary: result.summary,
      reports: result.reports,
    });
  });

  return router;
};
