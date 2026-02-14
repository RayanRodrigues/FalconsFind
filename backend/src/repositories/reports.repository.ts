import type { Firestore } from 'firebase-admin/firestore';
import type { Report } from '../contracts/index.js';

export const saveReport = async (
  db: Firestore,
  report: Omit<Report, 'id'>,
): Promise<{ id: string; report: Report }> => {
  const docRef = await db.collection('reports').add(report);
  return {
    id: docRef.id,
    report: {
      id: docRef.id,
      ...report,
    },
  };
};
