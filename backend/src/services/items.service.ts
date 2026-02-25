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

  const baseQuery = db
    .collection('reports')
    .where('kind', '==', 'FOUND')
    .where('status', '==', 'VALIDATED');

  const totalAgg = await baseQuery.count().get();
  const total = totalAgg.data().count;

  const pageSnap = await baseQuery
    .orderBy('dateReported', 'desc')
    .offset(offset)
    .limit(limit)
    .get();

  const items = pageSnap.docs.map((doc) => {
    const data = doc.data() as Omit<Report, 'id'> & { dateReported?: unknown };
    let dateReported = data.dateReported;

    if (
      typeof dateReported === 'object'
      && dateReported !== null
      && typeof (dateReported as { toDate?: unknown }).toDate === 'function'
    ) {
      dateReported = (dateReported as { toDate: () => Date }).toDate().toISOString();
    }

    return {
      id: doc.id,
      ...data,
      dateReported: dateReported as string,
    } as Report;
  });

  return { items, total };
};
