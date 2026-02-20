export const PHOTO_UPLOAD_CONFIG = {
  validMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'] as const,
  maxPhotoSizeBytes: 5 * 1024 * 1024,
  maxPhotos: 5
} as const;

export type PhotoMergeResult = {
  photos: File[];
  error: string | null;
};

const isSameFile = (left: File, right: File): boolean => (
  left.name === right.name
  && left.size === right.size
  && left.type === right.type
  && left.lastModified === right.lastModified
);

export const mergeSelectedPhotos = (
  currentPhotos: File[],
  incomingPhotos: File[],
): PhotoMergeResult => {
  const nextPhotos = [...currentPhotos];
  let nextError: string | null = null;

  for (const file of incomingPhotos) {
    if (!PHOTO_UPLOAD_CONFIG.validMimeTypes.includes(file.type as (typeof PHOTO_UPLOAD_CONFIG.validMimeTypes)[number])) {
      nextError ??= 'Please select valid image files (JPEG, PNG).';
      continue;
    }

    if (file.size > PHOTO_UPLOAD_CONFIG.maxPhotoSizeBytes) {
      nextError ??= 'Each file must be less than 5MB.';
      continue;
    }

    const duplicateIndex = nextPhotos.findIndex((existingFile) => isSameFile(existingFile, file));
    if (duplicateIndex >= 0) {
      nextPhotos[duplicateIndex] = file;
      continue;
    }

    if (nextPhotos.length >= PHOTO_UPLOAD_CONFIG.maxPhotos) {
      nextError ??= `You can upload up to ${PHOTO_UPLOAD_CONFIG.maxPhotos} photos.`;
      break;
    }

    nextPhotos.push(file);
  }

  return {
    photos: nextPhotos,
    error: nextError
  };
};
