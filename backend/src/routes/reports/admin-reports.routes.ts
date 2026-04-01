import { ItemStatus, UserRole } from '../../contracts/index.js';
import { invalidatePublicItemsCache } from '../../services/items/item-query-cache.service.js';
import { invalidateAdminReportsCache } from '../../services/reports/report-admin-query-cache.service.js';
import { API_PREFIX, HttpError } from '../route-utils.js';
import { createJsonRateLimiter } from '../rate-limit.js';
import { parseOptionalString, parsePositiveInt } from '../request-parsers.js';
import { parseBodyOrThrow } from '../schema-validation.js';
import { getSingleRouteParam } from './reports-router-modules.js';
import type { ReportsRouterDeps } from './reports-router-modules.js';

export const registerAdminReportRoutes = ({
  router,
  db,
  bucket,
  redis,
  requireStaffUser,
  schemaModule,
  reportsServiceModule,
}: ReportsRouterDeps): void => {
  const validateReportLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    message: 'Too many report validation attempts. Please try again later.',
  });
  const listReportsLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    message: 'Too many admin report list requests. Please try again later.',
  });
  const flagReportLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    message: 'Too many report flagging attempts. Please try again later.',
  });
  const mergeReportsLimiter = createJsonRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: 'Too many report merge attempts. Please try again later.',
  });

  router.patch(`${API_PREFIX}/reports/found/:id/validate`, validateReportLimiter, requireStaffUser, async (req, res) => {
    const reportId = getSingleRouteParam(req.params.id);
    if (!reportId) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const actor = res.locals.authUser as {
      uid: string;
      email?: string | null;
      role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY>;
    } | undefined;
    if (!actor?.uid || (actor.role !== 'ADMIN' && actor.role !== 'SECURITY')) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    try {
      const result = await reportsServiceModule.validateFoundReport(db, reportId, actor);
      await invalidateAdminReportsCache(redis);
      await invalidatePublicItemsCache(redis, reportId);
      res.status(200).json({
        id: result.id,
        referenceCode: result.report.referenceCode,
        status: result.report.status,
      });
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof reportsServiceModule.ReportValidationConflictError) {
        throw new HttpError(409, 'REPORT_VALIDATION_CONFLICT', error.message);
      }

      throw error;
    }
  });

  router.get(`${API_PREFIX}/admin/reports`, listReportsLimiter, requireStaffUser, async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
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

    const result = await reportsServiceModule.listAdminReports(db, bucket, redis, {
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
      filters: { kind: kind ?? null, status: status ?? null, search: search ?? null, flagged: flagged ?? null },
      summary: result.summary,
      reports: result.reports,
    });
  });

  router.patch(`${API_PREFIX}/admin/reports/:id/flag`, flagReportLimiter, requireStaffUser, async (req, res) => {
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
      await invalidateAdminReportsCache(redis);
      res.status(200).json({
        id: result.id,
        isSuspicious: result.report.isSuspicious,
        flagReason: result.report.suspiciousReason ?? null,
        flaggedAt: result.report.suspiciousFlaggedAt ?? null,
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

  router.post(`${API_PREFIX}/admin/reports/merge`, mergeReportsLimiter, requireStaffUser, async (req, res) => {
    const payload = parseBodyOrThrow(schemaModule.mergeDuplicateReportsSchema, req.body);
    const actor = res.locals.authUser as {
      uid: string;
      email?: string | null;
      role: Extract<UserRole, UserRole.ADMIN | UserRole.SECURITY>;
    } | undefined;
    if (!actor?.uid || (actor.role !== 'ADMIN' && actor.role !== 'SECURITY')) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    try {
      const result = await reportsServiceModule.mergeDuplicateReports(db, payload, actor);
      await invalidateAdminReportsCache(redis);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof reportsServiceModule.ReportNotFoundError) {
        throw new HttpError(404, 'NOT_FOUND', error.message);
      }

      if (error instanceof reportsServiceModule.ReportMergeConflictError) {
        throw new HttpError(409, 'REPORT_MERGE_CONFLICT', error.message);
      }

      throw error;
    }
  });
};
