import { mergeSelectedPhotos, PHOTO_UPLOAD_CONFIG } from './photo-upload.util';

describe('mergeSelectedPhotos', () => {
  const createImageFile = (
    name: string,
    size = 100,
    type = 'image/jpeg',
    lastModified = 1,
  ): File => new File([new Uint8Array(size)], name, { type, lastModified });

  it('adds valid photos', () => {
    const fileA = createImageFile('a.jpg');
    const fileB = createImageFile('b.jpg');

    const result = mergeSelectedPhotos([], [fileA, fileB]);

    expect(result.photos).toEqual([fileA, fileB]);
    expect(result.error).toBeNull();
  });

  it('rejects invalid mime type', () => {
    const invalid = createImageFile('file.gif', 100, 'image/gif');

    const result = mergeSelectedPhotos([], [invalid]);

    expect(result.photos).toEqual([]);
    expect(result.error).toBe('Please select valid image files (JPEG, PNG).');
  });

  it('enforces max photo limit', () => {
    const existing = Array.from({ length: PHOTO_UPLOAD_CONFIG.maxPhotos }, (_, index) =>
      createImageFile(`p-${index}.jpg`, 100, 'image/jpeg', index + 1),
    );
    const extra = createImageFile('overflow.jpg');

    const result = mergeSelectedPhotos(existing, [extra]);

    expect(result.photos.length).toBe(PHOTO_UPLOAD_CONFIG.maxPhotos);
    expect(result.error).toBe(`You can upload up to ${PHOTO_UPLOAD_CONFIG.maxPhotos} photos.`);
  });
});
