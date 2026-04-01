import rateLimit from 'express-rate-limit';
import { API_PREFIX, HttpError } from '../route-utils.js';
import { uploadSinglePhoto, getValidatedUploadedPhoto } from '../report-photo-upload.js';
import { parseBodyOrThrow } from '../schema-validation.js';
import { getSingleRouteParam } from './reports-router-modules.js';
import type { ReportsRouterDeps } from './reports-router-modules.js';

export const registerPublicReportRoutes = ({
  router,
  db,
  bucket,
  schemaModule,
  reportsServiceModule,
}: ReportsRouterDeps): void => {
  const editableReportPaths = [
    `${API_PREFIX}/reports/:referenceCode`,
    `${API_PREFIX}/reports/reference/:referenceCode`,
  ];

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

  router.post(`${API_PREFIX}/reports/lost`, createReportLimiter, uploadSinglePhoto, async (req, res) => {
    const photo = getValidatedUploadedPhoto(req.file, { required: false });
    const payload = parseBodyOrThrow(schemaModule.createLostReportSchema, req.body);

    try {
      const result = await reportsServiceModule.createLostReport(db, bucket, payload, photo);
      res.status(201).json({ id: result.id, referenceCode: result.report.referenceCode });
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportPhotoUploadError) {
        if (error.code === 'INVALID_PHOTO_DATA_URL') {
          throw new HttpError(400, 'BAD_REQUEST', error.message);
        }

        throw new HttpError(503, 'PHOTO_UPLOAD_FAILED', error.message);
      }

      throw error;
    }
  });

  router.post(`${API_PREFIX}/reports/found`, createReportLimiter, uploadSinglePhoto, async (req, res) => {
    const photo = getValidatedUploadedPhoto(req.file, { required: true });
    const payload = parseBodyOrThrow(schemaModule.createFoundReportSchema, req.body);

    try {
      const result = await reportsServiceModule.createFoundReport(db, bucket, payload, photo);
      res.status(201).json({ id: result.id, referenceCode: result.report.referenceCode });
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportPhotoUploadError) {
        if (error.code === 'INVALID_PHOTO_DATA_URL') {
          throw new HttpError(400, 'BAD_REQUEST', error.message);
        }

        throw new HttpError(503, 'PHOTO_UPLOAD_FAILED', error.message);
      }

      throw error;
    }
  });

  router.get(editableReportPaths, async (req, res) => {
    const referenceCode = getSingleRouteParam(req.params.referenceCode).toUpperCase();
    if (!referenceCode) {
      throw new HttpError(400, 'BAD_REQUEST', 'referenceCode is required');
    }

    try {
      const report = await reportsServiceModule.getReportByReferenceCode(db, referenceCode);
      res.status(200).json(report);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      throw error;
    }
  });

  router.patch(editableReportPaths, async (req, res) => {
    const referenceCode = getSingleRouteParam(req.params.referenceCode).toUpperCase();
    if (!referenceCode) {
      throw new HttpError(400, 'BAD_REQUEST', 'referenceCode is required');
    }

    const payload = parseBodyOrThrow(schemaModule.updateReportByReferenceSchema, req.body);

    try {
      const report = await reportsServiceModule.updateReportByReferenceCode(db, referenceCode, payload);
      res.status(200).json(report);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof reportsServiceModule.ReportEditConflictError) {
        throw new HttpError(409, 'REPORT_EDIT_CONFLICT', error.message);
      }

      throw error;
    }
  });
};
