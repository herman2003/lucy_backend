import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import {
  EXPLANATION_STYLES,
  FEEDBACK_TONES,
  LEARNING_GOALS,
  MAIN_DOMAINS,
  PRIMARY_ROLES,
  SELF_ASSESSED_LEVELS,
  TUTORING_LANGUAGES,
  type LearnerProfile,
} from '../domain/learner-profile.enums';
import type {
  AnalyzeFallbackDto,
  AnalyzeSuccessDto,
} from '../dto/analyze-response.dto';

export function parseAnalyzeLlmResponse(parsed: unknown): AnalyzeSuccessDto {
  if (!parsed || typeof parsed !== 'object') {
    throw profileIncomplete('LLM response is not an object');
  }

  const record = parsed as Record<string, unknown>;
  const summaryForUser = record.summaryForUser;
  if (typeof summaryForUser !== 'string' || !summaryForUser.trim()) {
    throw profileIncomplete('summaryForUser is required');
  }

  const learnerProfile = parseLearnerProfile(record.learnerProfile);

  return {
    learnerProfile,
    summaryForUser: summaryForUser.trim(),
  };
}

export function parseAnalyzeFallbackLlmResponse(
  parsed: unknown,
): AnalyzeFallbackDto {
  if (!parsed || typeof parsed !== 'object') {
    throw profileIncomplete('LLM fallback response is not an object');
  }

  const record = parsed as Record<string, unknown>;
  const fallbackProfileSummary = record.fallbackProfileSummary;
  if (
    typeof fallbackProfileSummary !== 'string' ||
    !fallbackProfileSummary.trim()
  ) {
    throw profileIncomplete('fallbackProfileSummary is required');
  }

  return {
    fallbackProfileSummary: fallbackProfileSummary.trim(),
    requiresUserConfirmation: true,
  };
}

/** Parses `users/{uid}.learnerProfile` (Firestore / in-memory user doc). */
export function parseLearnerProfile(value: unknown): LearnerProfile {
  if (!value || typeof value !== 'object') {
    throw profileIncomplete('learnerProfile is required');
  }

  const record = value as Record<string, unknown>;
  const missing: string[] = [];

  const primary_role = readEnum(
    record.primary_role,
    PRIMARY_ROLES,
    'primary_role',
    missing,
  );
  const main_domains = readDomainArray(record.main_domains, missing);
  const learning_goal = readEnum(
    record.learning_goal,
    LEARNING_GOALS,
    'learning_goal',
    missing,
  );
  const self_assessed_level = readEnum(
    record.self_assessed_level,
    SELF_ASSESSED_LEVELS,
    'self_assessed_level',
    missing,
  );
  const explanation_style = readEnum(
    record.explanation_style,
    EXPLANATION_STYLES,
    'explanation_style',
    missing,
  );
  const feedback_tone = readEnum(
    record.feedback_tone,
    FEEDBACK_TONES,
    'feedback_tone',
    missing,
  );
  const tutoring_language = readEnum(
    record.tutoring_language,
    TUTORING_LANGUAGES,
    'tutoring_language',
    missing,
  );

  if (
    missing.length > 0 ||
    !primary_role ||
    !main_domains ||
    !learning_goal ||
    !self_assessed_level ||
    !explanation_style ||
    !feedback_tone ||
    !tutoring_language
  ) {
    throw profileIncomplete('learnerProfile has invalid or missing fields', missing);
  }

  return {
    primary_role,
    main_domains,
    learning_goal,
    self_assessed_level,
    explanation_style,
    feedback_tone,
    tutoring_language,
  };
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  missing: string[],
): T | undefined {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    missing.push(field);
    return undefined;
  }
  return value as T;
}

function readDomainArray(
  value: unknown,
  missing: string[],
): LearnerProfile['main_domains'] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    missing.push('main_domains');
    return undefined;
  }

  const domains: LearnerProfile['main_domains'] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !(MAIN_DOMAINS as readonly string[]).includes(item)) {
      missing.push('main_domains');
      return undefined;
    }
    domains.push(item as LearnerProfile['main_domains'][number]);
  }
  return domains;
}

function profileIncomplete(
  message: string,
  missingFields: string[] = [],
): LucyApiError {
  return new LucyApiError(
    422,
    LucyErrorCodes.ONBOARDING_PROFILE_INCOMPLETE,
    message,
    missingFields.length > 0 ? { missingFields } : undefined,
  );
}
