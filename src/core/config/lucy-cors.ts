import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Flutter web dev servers (any port on loopback). */
const LOCALHOST_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function parseCorsAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  extraOrigins: readonly string[],
): boolean {
  if (!origin) {
    return true;
  }
  if (extraOrigins.includes(origin)) {
    return true;
  }
  return LOCALHOST_ORIGIN_PATTERN.test(origin);
}

export function buildCorsOptions(
  extraOrigins: readonly string[],
): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isCorsOriginAllowed(origin, extraOrigins));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  };
}
