import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { CreateLostReportRequest } from '../contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_PREFIX, sendError } from './route-utils.js';

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
};
const reportsServiceModule = (await import(pathToFileURL(servicePath).href)) as {
  createLostReport: (
    db: Firestore,
    bucket: Bucket,
    payload: CreateLostReportRequest,
  ) => Promise<{ id: string; report: { referenceCode: string } }>;
};

export const createReportsRouter = (db: Firestore, bucket: Bucket): Router => {
  const router = Router();

  router.post(`${API_PREFIX}/reports/lost`, async (req, res) => {
    const parsed = schemaModule.createLostReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
      sendError(res, 400, 'BAD_REQUEST', message);
      return;
    }

    try {
      const result = await reportsServiceModule.createLostReport(db, bucket, parsed.data);
      res.status(201).json({
        id: result.id,
        referenceCode: result.report.referenceCode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

  return router;
};
