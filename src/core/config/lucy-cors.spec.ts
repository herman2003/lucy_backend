import {
  buildCorsOptions,
  isCorsOriginAllowed,
  parseCorsAllowedOrigins,
} from './lucy-cors';

describe('parseCorsAllowedOrigins', () => {
  it('returns empty array when unset', () => {
    expect(parseCorsAllowedOrigins(undefined)).toEqual([]);
    expect(parseCorsAllowedOrigins('')).toEqual([]);
  });

  it('splits comma-separated origins', () => {
    expect(
      parseCorsAllowedOrigins(
        'https://app.lucy.example, https://lucy.web.app ',
      ),
    ).toEqual(['https://app.lucy.example', 'https://lucy.web.app']);
  });
});

describe('isCorsOriginAllowed', () => {
  const extra = ['https://app.lucy.example'];

  it('allows missing origin (non-browser clients)', () => {
    expect(isCorsOriginAllowed(undefined, extra)).toBe(true);
  });

  it('allows configured production origins', () => {
    expect(isCorsOriginAllowed('https://app.lucy.example', extra)).toBe(true);
  });

  it('allows localhost and 127.0.0.1 with any port', () => {
    expect(isCorsOriginAllowed('http://localhost:8080', extra)).toBe(true);
    expect(isCorsOriginAllowed('http://127.0.0.1:52431', extra)).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isCorsOriginAllowed('https://evil.example', extra)).toBe(false);
    expect(isCorsOriginAllowed('http://localhost.evil.com', extra)).toBe(
      false,
    );
  });
});

describe('buildCorsOptions', () => {
  it('exposes Authorization for Dio preflight', () => {
    const options = buildCorsOptions([]);
    expect(options.allowedHeaders).toContain('Authorization');
    expect(options.methods).toContain('POST');
    expect(options.methods).toContain('PATCH');
    expect(options.methods).toContain('DELETE');
  });
});
