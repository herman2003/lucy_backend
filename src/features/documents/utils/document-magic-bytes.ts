/** Detect MIME from file head bytes (C1). Returns null if unknown. */
export function detectMimeFromBytes(head: Buffer): string | null {
  if (head.length >= 4 && head.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }
  if (
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    head[2] === 0x03 &&
    head[3] === 0x04
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (head.length > 0 && isValidUtf8Text(head)) {
    return 'text/plain';
  }
  return null;
}

function isValidUtf8Text(buf: Buffer): boolean {
  try {
    const text = buf.toString('utf8');
    if (text.includes('\uFFFD')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
