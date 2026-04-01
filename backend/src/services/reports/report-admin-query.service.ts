import type { Bucket } from '@google-cloud/storage';
import type { Firestore, Query } from 'firebase-admin/firestore';
import type { AdminReportResponse, Report } from '../../contracts/index.js';
import { ItemStatus } from '../../contracts/index.js';
import { archiveExpiredUnclaimedItems } from '../items/item-archive.service.js';
import { mapAdminReport } from './report-media.js';
import type { ListAdminReportsParams } from './report-types.js';

export const listAdminReports = async (
  db: Firestore,
  bucket: Bucket,
  params: ListAdminReportsParams,
): Promise<{
  reports: AdminReportResponse[];
  total: number;
  summary: {
    totalReports: number;
    lostReports: number;
    foundReports: number;
    byStatus: Partial<Record<ItemStatus, number>>;
  };
}> => {
  await archiveExpiredUnclaimedItems(db);
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.floor(params.limit));
  const offset = (page - 1) * limit;
  const search = typeof params.search === 'string' ? params.search.trim().toLowerCase() : '';

  let reportsQuery: Query = db.collection('reports');
  if (params.kind) reportsQuery = reportsQuery.where('kind', '==', params.kind);
  if (params.status) reportsQuery = reportsQuery.where('status', '==', params.status);

  const reportsSnap = await reportsQuery.get();
  const allReports = (await Promise.all(
    reportsSnap.docs.map((doc) => mapAdminReport(bucket, doc.id, doc.data() as Partial<Report>)),
  ))
    .filter((report): report is AdminReportResponse => report !== null)
    .sort((a, b) => b.dateReported.localeCompare(a.dateReported));

  const filteredReports = allReports.filter((report) => {
    if (typeof params.flagged === 'boolean' && report.isSuspicious !== params.flagged) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [
      report.title,
      report.description ?? '',
      report.referenceCode,
      report.location ?? '',
      report.contactEmail ?? '',
    ].join(' ').toLowerCase();

    return searchableText.includes(search);
  });

  const byStatus = filteredReports.reduce<Partial<Record<ItemStatus, number>>>((acc, report) => {
    acc[report.status] = (acc[report.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    reports: filteredReports.slice(offset, offset + limit),
    total: filteredReports.length,
    summary: {
      totalReports: filteredReports.length,
      lostReports: filteredReports.filter((report) => report.kind === 'LOST').length,
      foundReports: filteredReports.filter((report) => report.kind === 'FOUND').length,
      byStatus,
    },
  };
};
