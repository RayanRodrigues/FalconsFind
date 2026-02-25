import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { ItemStatus } from '../contracts/index.js';
import type { ItemDetailsResponse } from '../contracts/index.js';

type StoredItem = {
  id?: string;
  title?: string;
  description?: string;
  status?: ItemStatus;
  referenceCode?: string;
  location?: string;
  dateReported?: string;
  imageUrls?: string[];
  photoUrl?: string;
  claimStatus?: ItemDetailsResponse['claimStatus'];
};

export class InvalidItemDataError extends Error {
  constructor() {
    super(
      'This item was incorrectly reported. If this was your report, please submit it again or contact Campus Security.',
    );
    this.name = 'InvalidItemDataError';
  }
}

const parseGsUrl = (value: string): { bucketName: string; filePath: string } | null => {
  if (!value.startsWith('gs://')) {
    return null;
  }

  const normalized = value.slice('gs://'.length);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return {
    bucketName: normalized.slice(0, slashIndex),
    filePath: normalized.slice(slashIndex + 1),
  };
};

const toPublicImageUrl = async (defaultBucket: Bucket, value: string): Promise<string> => {
  const gs = parseGsUrl(value);
  if (!gs) {
    return value;
  }

  const targetBucket =
    gs.bucketName === defaultBucket.name
      ? defaultBucket
      : defaultBucket.storage.bucket(gs.bucketName);

  const [url] = await targetBucket.file(gs.filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60,
  });
  return url;
};

const resolveImageUrls = async (bucket: Bucket, source: StoredItem): Promise<string[] | undefined> => {
  const rawUrls = source.imageUrls ?? (source.photoUrl ? [source.photoUrl] : undefined);
  if (!rawUrls || rawUrls.length === 0) {
    return undefined;
  }

  const urls = await Promise.all(
    rawUrls
      .filter((url) => typeof url === 'string' && url.trim().length > 0)
      .map(async (url) => {
        try {
          return await toPublicImageUrl(bucket, url);
        } catch {
          return url;
        }
      }),
  );

  return urls.length > 0 ? urls : undefined;
};

const mapItemDetails = async (
  bucket: Bucket,
  id: string,
  source: StoredItem,
): Promise<ItemDetailsResponse> => {
  if (
    typeof source.title !== 'string' ||
    source.title.trim().length === 0 ||
    typeof source.referenceCode !== 'string' ||
    source.referenceCode.trim().length === 0 ||
    typeof source.dateReported !== 'string' ||
    source.dateReported.trim().length === 0 ||
    !source.status ||
    !Object.values(ItemStatus).includes(source.status)
  ) {
    throw new InvalidItemDataError();
  }

  const imageUrls = await resolveImageUrls(bucket, source);

  return {
    id,
    title: source.title,
    description: source.description,
    status: source.status,
    location: source.location,
    referenceCode: source.referenceCode,
    dateReported: source.dateReported,
    imageUrls,
    claimStatus: source.claimStatus,
  };
};

export const getItemById = async (
  db: Firestore,
  bucket: Bucket,
  itemId: string,
): Promise<ItemDetailsResponse | null> => {
  const itemSnapshot = await db.collection('items').doc(itemId).get();
  if (itemSnapshot.exists) {
    const data = itemSnapshot.data() as DocumentData;
    return mapItemDetails(bucket, itemSnapshot.id, data);
  }

  // Transitional fallback: while the item-validation flow is not fully connected,
  // allow item details lookup by report id as well. Visibility rules are still
  // enforced by the route layer.
  const reportSnapshot = await db.collection('reports').doc(itemId).get();
  if (!reportSnapshot.exists) {
    return null;
  }

  const reportData = reportSnapshot.data() as DocumentData;

  return mapItemDetails(bucket, reportSnapshot.id, reportData);
};

export const isItemPubliclyVisible = (item: ItemDetailsResponse): boolean => {
  return item.status === 'VALIDATED';
};
