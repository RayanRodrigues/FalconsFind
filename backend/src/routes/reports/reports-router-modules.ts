import type { RequestHandler, Router } from 'express';
import type { Bucket } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { RedisClient } from '../../bootstrap/redis.js';
import type {
  CreateFoundReportRequest,
  CreateLostReportRequest,
  EditableReportResponse,
  FlagReportRequest,
  MergeDuplicateReportsRequest,
  MergeDuplicateReportsResponse,
  UpdateReportByReferenceRequest,
  UserRole,
  ItemStatus,
} from '../../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaTsPath = path.resolve(__dirname, '../../schemas/reports.schema.ts');
const schemaJsPath = path.resolve(__dirname, '../../schemas/reports.schema.js');
const serviceTsPath = path.resolve(__dirname, '../../services/reports.service.ts');
const serviceJsPath = path.resolve(__dirname, '../../services/reports.service.js');

const schemaPath = fs.existsSync(schemaTsPath) ? schemaTsPath : schemaJsPath;
const servicePath = fs.existsSync(serviceTsPath) ? serviceTsPath : serviceJsPath;

export type ReportsSchemaModule = {
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
  mergeDuplicateReportsSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: MergeDuplicateReportsRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
  updateReportByReferenceSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: UpdateReportByReferenceRequest } | { success: false; error: { issues: Array<{ message?: string }> } };
  };
};

export type ReportsServiceModule = {
  ReportPhotoUploadError: new (
    code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED',
    message: string,
  ) => Error & { code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED' };
  ReportNotFoundError: new () => Error;
  ReportEditConflictError: new (message: string) => Error;
  ReportValidationConflictError: new (message: string) => Error;
  ReportMergeConflictError: new (message: string) => Error;
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
    actor?: { uid: string; email?: string | null; role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY> },
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
  mergeDuplicateReports: (
    db: Firestore,
    payload: MergeDuplicateReportsRequest,
    actor: { uid: string; email?: string | null; role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY> },
  ) => Promise<MergeDuplicateReportsResponse>;
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

export type ReportsRouterDeps = {
  router: Router;
  db: Firestore;
  bucket: Bucket;
  redis: RedisClient | null;
  requireStaffUser: RequestHandler;
  schemaModule: ReportsSchemaModule;
  reportsServiceModule: ReportsServiceModule;
};

export const getSingleRouteParam = (value: string | string[] | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const schemaModule = (await import(pathToFileURL(schemaPath).href)) as ReportsSchemaModule;
export const reportsServiceModule = (await import(pathToFileURL(servicePath).href)) as ReportsServiceModule;
