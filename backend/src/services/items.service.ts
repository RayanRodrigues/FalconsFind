import type { Firestore } from 'firebase-admin/firestore';
import type { Report } from '../contracts/index.js';

type ListValidatedItemsParams = {
  page: number;
  limit: number;
};

export const listValidatedItems = async (
  db: Firestore,
  params: ListValidatedItemsParams,
): Promise<{ items: Array<Report>; total: number }> => {
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.floor(params.limit));
  const offset = (page - 1) * limit;

  // Base query: only FOUND + VALIDATED items
  const baseQuery = db
    .collection('reports')
    .where('kind', '==', 'FOUND')
    .where('status', '==', 'VALIDATED');

  // 1) Total count (simple approach)
  // NOTE: This reads all matching docs to count them.
  // If your dataset grows huge, you’d switch to Firestore count() aggregation.
  const totalSnap = await baseQuery.get();
  const total = totalSnap.size;

  // 2) Paged results
  // orderBy is required for stable pagination with offset
  const pageSnap = await baseQuery
    .orderBy('dateReported', 'desc')
    .offset(offset)
    .limit(limit)
    .get();

  const items = pageSnap.docs.map((doc) => {
    const data = doc.data() as Omit<Report, 'id'>;
    return {
      id: doc.id,
      ...data,
    } as Report;
  });

  return { items, total };
};