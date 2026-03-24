import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { ItemStatus, UserRole } from '../contracts/index.js';
import type {
  CreateFoundReportRequest,
  CreateLostReportRequest,
  EditableReportResponse,
  FlagReportRequest,
  UpdateReportByReferenceRequest,
} from '../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_PREFIX, HttpError } from './route-utils.js';
import { parseOptionalString, parsePositiveInt } from './request-parsers.js';
import { uploadSinglePhoto, getValidatedUploadedPhoto } from './report-photo-upload.js';
import { parseBodyOrThrow } from './schema-validation.js';
import { createRequireStaffRoles } from '../middleware/require-staff-user.js';

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
  flagReportSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: FlagReportRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
  updateReportByReferenceSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: UpdateReportByReferenceRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
};

const reportsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  ReportPhotoUploadError: new (
    code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED',
    message: string,
  ) => Error & { code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED' };
  ReportNotFoundError: new () => Error;
  ReportEditConflictError: new (message: string) => Error;
  ReportValidationConflictError: new (message: string) => Error;
  createLostReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateLostReportRequest,
    photo?: { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' },
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
  createFoundReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateFoundReportRequest,
    photo: { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' },
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
  getReportByReferenceCode: (
    db: Firestore,
    referenceCode: string,
  ) => Promise<EditableReportResponse>;
  updateReportByReferenceCode: (
    db: Firestore,
    referenceCode: string,
    payload: UpdateReportByReferenceRequest,
  ) => Promise<EditableReportResponse>;
  validateFoundReport: (
    db: Firestore,
    reportId: string,
  ) => Promise<{ id: string; report: { status: string; referenceCode: string } }>;
  flagReport: (
    db: Firestore,
    reportId: string,
    payload: FlagReportRequest,
    actor: { uid: string; email?: string | null; role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY> },
  ) => Promise<{
    id: string;
    report: {
      isSuspicious: boolean;
      suspiciousReason?: string | null;
      suspiciousFlaggedAt?: string | null;
      suspiciousFlaggedByUid?: string | null;
      suspiciousFlaggedByEmail?: string | null;
      suspiciousFlaggedByRole?: string | null;
    };
  }>;
  listAdminReports: (
    db: Firestore,
    bucket: Bucket,
    params: {
      page: number;
      limit: number;
      kind?: 'LOST' | 'FOUND';
      status?: ItemStatus;
      search?: string;
      flagged?: boolean;
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

const getSingleRouteParam = (value: string | string[] | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

type ReportsRouterOptions = {
  requireStaffUser?: RequestHandler;
};

export const createReportsRouter = (
  db: Firestore,
  bucket: Bucket,
  options: ReportsRouterOptions = {},
): Router => {
  const router = Router();
  const requireStaffUser = options.requireStaffUser ?? createRequireStaffRoles(db, [UserRole.ADMIN, UserRole.SECURITY]);
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
  router.post(
    `${API_PREFIX}/reports/lost`,
    createReportLimiter,
    uploadSinglePhoto,
    async (req, res) => {
      const photo = getValidatedUploadedPhoto(req.file, { required: false });
      const payload = parseBodyOrThrow(schemaModule.createLostReportSchema, req.body);

      let result: { id: string; report: { referenceCode: string } };
      try {
        result = await reportsServiceModule.createLostReport(
          db,
          bucket,
          payload,
          photo,
        );
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

  router.post(
    `${API_PREFIX}/reports/found`,
    createReportLimiter,
    uploadSinglePhoto,
    async (req, res) => {
      const photo = getValidatedUploadedPhoto(req.file, { required: true });
      const payload = parseBodyOrThrow(schemaModule.createFoundReportSchema, req.body);

      let result: { id: string; report: { referenceCode: string } };
      try {
        result = await reportsServiceModule.createFoundReport(db, bucket, payload, photo);
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

  router.get(`${API_PREFIX}/reports/reference/:referenceCode`, async (req, res) => {
    const referenceCode = req.params.referenceCode?.trim().toUpperCase();
    if (!referenceCode) {
      throw new HttpError(400, 'BAD_REQUEST', 'referenceCode is required');
    }

    let report: EditableReportResponse;
    try {
      report = await reportsServiceModule.getReportByReferenceCode(db, referenceCode);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      throw error;
    }

    res.status(200).json(report);
  });

  router.patch(`${API_PREFIX}/reports/found/:id/validate`, requireStaffUser, async (req, res) => {
    const reportId = getSingleRouteParam(req.params.id);
    if (!reportId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    let result: { id: string; report: { status: string; referenceCode: string } };
    try {
      result = await reportsServiceModule.validateFoundReport(db, reportId);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof reportsServiceModule.ReportValidationConflictError) {
        throw new HttpError(409, 'REPORT_VALIDATION_CONFLICT', error.message);
      }

      throw error;
    }

    res.status(200).json({
      id: result.id,
      referenceCode: result.report.referenceCode,
      status: result.report.status,
    });
  });

  router.patch(`${API_PREFIX}/reports/reference/:referenceCode`, async (req, res) => {
    const referenceCode = req.params.referenceCode?.trim().toUpperCase();
    if (!referenceCode) {
      throw new HttpError(400, 'BAD_REQUEST', 'referenceCode is required');
    }

    const payload = parseBodyOrThrow(schemaModule.updateReportByReferenceSchema, req.body);

    let report: EditableReportResponse;
    try {
      report = await reportsServiceModule.updateReportByReferenceCode(db, referenceCode, payload);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof reportsServiceModule.ReportEditConflictError) {
        throw new HttpError(409, 'REPORT_EDIT_CONFLICT', error.message);
      }

      throw error;
    }

    res.status(200).json(report);
  });

  router.get(`${API_PREFIX}/admin/reports`, requireStaffUser, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limitRaw = parsePositiveInt(req.query.limit, 20);
    const limit = Math.min(limitRaw, 100);
    const kindRaw = parseOptionalString(req.query.kind);
    const statusRaw = parseOptionalString(req.query.status);
    const search = parseOptionalString(req.query.search);
    const flaggedRaw = parseOptionalString(req.query.flagged);

    const kind = kindRaw === 'LOST' || kindRaw === 'FOUND' ? kindRaw : undefined;
    if (kindRaw && !kind) {
      throw new HttpError(400, 'BAD_REQUEST', 'kind must be LOST or FOUND');
    }

    const allowedStatuses = new Set<string>(Object.values(ItemStatus));
    const status = statusRaw && allowedStatuses.has(statusRaw) ? statusRaw as ItemStatus : undefined;
    if (statusRaw && !status) {
      throw new HttpError(400, 'BAD_REQUEST', `status must be one of: ${Object.values(ItemStatus).join(', ')}`);
    }

    const flagged = flaggedRaw === 'true' ? true : flaggedRaw === 'false' ? false : undefined;
    if (flaggedRaw && flagged === undefined) {
      throw new HttpError(400, 'BAD_REQUEST', 'flagged must be true or false');
    }

    const result = await reportsServiceModule.listAdminReports(db, bucket, {
      page,
      limit,
      kind,
      status,
      search,
      flagged,
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
        flagged: flagged ?? null,
      },
      summary: result.summary,
      reports: result.reports,
    });
  });

  router.patch(`${API_PREFIX}/admin/reports/:id/flag`, requireStaffUser, async (req, res) => {
    const reportId = getSingleRouteParam(req.params.id);
    if (!reportId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const payload = parseBodyOrThrow(schemaModule.flagReportSchema, req.body);
    const actor = res.locals.authUser as {
      uid: string;
      email?: string | null;
      role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY>;
    } | undefined;
    if (!actor?.uid || (actor.role !== 'ADMIN' && actor.role !== 'SECURITY')) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    try {
      const result = await reportsServiceModule.flagReport(db, reportId, payload, actor);
      res.status(200).json({
        id: result.id,
        isSuspicious: result.report.isSuspicious,
        suspiciousReason: result.report.suspiciousReason ?? null,
        suspiciousFlaggedAt: result.report.suspiciousFlaggedAt ?? null,
        suspiciousFlaggedByUid: result.report.suspiciousFlaggedByUid ?? null,
        suspiciousFlaggedByEmail: result.report.suspiciousFlaggedByEmail ?? null,
        suspiciousFlaggedByRole: result.report.suspiciousFlaggedByRole ?? null,
      });
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      throw error;
    }
  });

  return router;
};
