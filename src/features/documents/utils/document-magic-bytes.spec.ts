import { detectMimeFromBytes } from './document-magic-bytes';

describe('detectMimeFromBytes', () => {
  it('detects PDF magic bytes', () => {
    expect(detectMimeFromBytes(Buffer.from('%PDF-1.4'))).toBe('application/pdf');
  });

  it('detects DOCX zip header', () => {
    expect(
      detectMimeFromBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])),
    ).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('detects UTF-8 text', () => {
    expect(detectMimeFromBytes(Buffer.from('hello', 'utf8'))).toBe('text/plain');
  });
});
