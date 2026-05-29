import * as admin from 'firebase-admin';

import { loadLucyConfig } from '../../../core/config/lucy-config';
import { FirebaseDocumentsStorage } from './firebase-documents.storage';

describe('FirebaseDocumentsStorage', () => {
  const config = loadLucyConfig({
    NODE_ENV: 'development',
    FIREBASE_PROJECT_ID: 'lucy-test',
    FIREBASE_STORAGE_BUCKET: 'lucy-test.appspot.com',
  });

  const getSignedUrl = jest.fn().mockResolvedValue(['https://signed.example/upload']);
  const exists = jest.fn();
  const getMetadata = jest.fn();
  const download = jest.fn();
  const deleteMock = jest.fn().mockResolvedValue(undefined);

  const fileMock = {
    getSignedUrl,
    exists,
    getMetadata,
    download,
    delete: deleteMock,
  };

  const bucketMock = {
    file: jest.fn().mockReturnValue(fileMock),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(admin, 'storage').mockReturnValue({
      bucket: jest.fn().mockReturnValue(bucketMock),
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates signed PUT URL with ~15 min expiry', async () => {
    const storage = new FirebaseDocumentsStorage(config);
    const path = 'users/u1/documents/d1/original.pdf';

    const result = await storage.getUploadSignedUrl(path, 'application/pdf');

    expect(result.url).toBe('https://signed.example/upload');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v4',
        action: 'write',
        contentType: 'application/pdf',
      }),
    );
    const expiresMs = getSignedUrl.mock.calls[0]?.[0]?.expires as number;
    expect(expiresMs - Date.now()).toBeGreaterThan(14 * 60_000);
  });

  it('isObjectPresent returns true when metadata size matches byteSize', async () => {
    exists.mockResolvedValue([true]);
    getMetadata.mockResolvedValue([{ size: '100' }]);

    const storage = new FirebaseDocumentsStorage(config);
    const ok = await storage.isObjectPresent('users/u1/documents/d1/original.txt', 100);

    expect(ok).toBe(true);
  });
});
