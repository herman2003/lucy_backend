import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { loadLucyConfig } from '../../../core/config/lucy-config';
import { R2DocumentsStorage } from './r2-documents.storage';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('R2DocumentsStorage', () => {
  const config = loadLucyConfig({
    NODE_ENV: 'development',
    STORAGE_PROVIDER: 'r2',
    R2_ACCOUNT_ID: 'f2996da6702148369f952b57fd1259aa',
    R2_BUCKET: 'lucy',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
  });

  const send = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (S3Client as jest.Mock).mockImplementation(() => ({ send }));
    (PutObjectCommand as unknown as jest.Mock).mockImplementation((input: unknown) => ({ input }));
    (getSignedUrl as jest.Mock).mockResolvedValue('https://r2.example/presigned');
  });

  it('creates S3 client with R2 endpoint and auto region', () => {
    new R2DocumentsStorage(config);

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://f2996da6702148369f952b57fd1259aa.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      }),
    );
  });

  it('generates presigned PUT URL with Content-Type', async () => {
    const storage = new R2DocumentsStorage(config);
    const path = 'users/u1/documents/d1/original.pdf';

    const result = await storage.getUploadSignedUrl(path, 'application/pdf');

    expect(result.url).toBe('https://r2.example/presigned');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: {
          Bucket: 'lucy',
          Key: path,
          ContentType: 'application/pdf',
        },
      }),
      expect.objectContaining({ expiresIn: 900 }),
    );
  });

  it('isObjectPresent returns true when HeadObject size matches', async () => {
    send.mockResolvedValue({ ContentLength: 100 });

    const storage = new R2DocumentsStorage(config);
    const ok = await storage.isObjectPresent('users/u1/documents/d1/original.txt', 100);

    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
  });

  it('detectMimeType reads first bytes via ranged GetObject', async () => {
    send.mockResolvedValue({
      Body: Buffer.from('%PDF-1.4'),
    });

    const storage = new R2DocumentsStorage(config);
    const mime = await storage.detectMimeType('users/u1/documents/d1/original.pdf');

    expect(mime).toBe('application/pdf');
    expect(send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
  });

  it('deleteObject sends DeleteObjectCommand', async () => {
    send.mockResolvedValue({});

    const storage = new R2DocumentsStorage(config);
    await storage.deleteObject('users/u1/documents/d1/original.pdf');

    expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });
});
