import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from './route-utils.js';

export type SupportedPhotoMimeType = 'image/jpeg' | 'image/png';

export type UploadedPhoto = {
  buffer: Buffer;
  mimeType: SupportedPhotoMimeType;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const detectAllowedImageMime = (buffer: Buffer): SupportedPhotoMimeType | null => {
  const isPng =
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
  if (isPng) {
    return 'image/png';
  }

  const isJpeg =
    buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
  if (isJpeg) {
    return 'image/jpeg';
  }

  return null;
};

export const uploadSinglePhoto: RequestHandler = (req, res, next) => {
  upload.single('photo')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    const message = error instanceof Error ? error.message : 'Invalid upload payload';
    next(new HttpError(400, 'BAD_REQUEST', message));
  });
};

export function getValidatedUploadedPhoto(
  file: Express.Multer.File | undefined,
  options: { required: true },
): UploadedPhoto;
export function getValidatedUploadedPhoto(
  file: Express.Multer.File | undefined,
  options: { required: false },
): UploadedPhoto | undefined;
export function getValidatedUploadedPhoto(
  file: Express.Multer.File | undefined,
  options: { required: boolean },
): UploadedPhoto | undefined {
  if (!file) {
    if (options.required) {
      throw new HttpError(400, 'BAD_REQUEST', 'photo is required');
    }

    return undefined;
  }

  const mimeType = detectAllowedImageMime(file.buffer);
  if (!mimeType) {
    throw new HttpError(400, 'BAD_REQUEST', 'photo must be a valid JPEG or PNG');
  }

  return {
    buffer: file.buffer,
    mimeType,
  };
}
