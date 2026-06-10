import { Injectable } from '@nestjs/common';

import type {
  LlmPort,
  LlmStructuredRequest,
  LlmStructuredResponse,
} from './llm.port';

const MOCK_LEARNER_PROFILE = {
  primary_role: 'student',
  main_domains: ['sciences'],
  learning_goal: 'exam',
  self_assessed_level: 'intermediate',
  explanation_style: 'step_by_step',
  feedback_tone: 'encouraging',
  tutoring_language: 'fr',
} as const;

/** Deterministic LLM for local dev when `LLM_PROVIDER=mock` (no Gemini API key). */
@Injectable()
export class MockLlmAdapter implements LlmPort {
  async generateStructured(
    input: LlmStructuredRequest,
  ): Promise<LlmStructuredResponse> {
    if (this.isAnalyzeFallbackRequest(input)) {
      return this.buildAnalyzeFallbackResponse(input.userPrompt);
    }
    if (this.isAnalyzeRequest(input)) {
      return this.buildAnalyzeResponse();
    }
    if (this.isChatCitationRequest(input)) {
      return this.buildChatCitationResponse(input.userPrompt);
    }
    if (this.isFlashcardsGenerationRequest(input)) {
      return this.buildFlashcardsGenerationResponse(input.userPrompt);
    }
    if (this.isQuizGenerationRequest(input)) {
      return this.buildQuizGenerationResponse(input.userPrompt);
    }
    return this.buildValidateResponse(input.userPrompt);
  }

  private isFlashcardsGenerationRequest(input: LlmStructuredRequest): boolean {
    return input.userPrompt.includes('GENERATE_FLASHCARD_ITEMS=true');
  }

  private isQuizGenerationRequest(input: LlmStructuredRequest): boolean {
    return input.userPrompt.includes('GENERATE_QUIZ_ITEMS=true');
  }

  private buildFlashcardsGenerationResponse(
    userPrompt: string,
  ): LlmStructuredResponse {
    const itemCountMatch = userPrompt.match(/ITEM_COUNT=(\d+)/);
    const itemCount = itemCountMatch
      ? Number.parseInt(itemCountMatch[1]!, 10)
      : 10;
    const chunkIds = extractJsonArrayAfterMarker(userPrompt, 'AVAILABLE_CHUNK_IDS=');
    const chunkId = chunkIds[0] ?? 'chunk_mock_1';

    const items = Array.from({ length: itemCount }, (_, index) => ({
      front: `Carte mock ${index + 1}`,
      back: `Réponse mock ${index + 1}`,
      sourceChunkIds: [chunkId],
    }));

    const payload = { items };
    return { rawText: JSON.stringify(payload), parsedJson: payload };
  }

  private buildQuizGenerationResponse(
    userPrompt: string,
  ): LlmStructuredResponse {
    const itemCountMatch = userPrompt.match(/ITEM_COUNT=(\d+)/);
    const itemCount = itemCountMatch
      ? Number.parseInt(itemCountMatch[1]!, 10)
      : 5;
    const chunkIds = extractJsonArrayAfterMarker(userPrompt, 'AVAILABLE_CHUNK_IDS=');
    const chunkId = chunkIds[0] ?? 'chunk_mock_1';

    const items = Array.from({ length: itemCount }, (_, index) => ({
      question: `Question mock ${index + 1} ?`,
      choices: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Explication mock.',
      sourceChunkIds: [chunkId],
    }));

    const payload = { items };
    return { rawText: JSON.stringify(payload), parsedJson: payload };
  }

  private isChatCitationRequest(input: LlmStructuredRequest): boolean {
    const schema = input.responseJsonSchema as { required?: string[] };
    return schema.required?.includes('citedChunkIds') ?? false;
  }

  private buildChatCitationResponse(userPrompt: string): LlmStructuredResponse {
    const chunkIds = extractJsonArrayAfterMarker(
      userPrompt,
      'AVAILABLE_CHUNK_IDS_JSON=',
    );
    const citedChunkIds = chunkIds.length > 0 ? [chunkIds[0]!] : [];
    const payload = { citedChunkIds };
    return { rawText: JSON.stringify(payload), parsedJson: payload };
  }

  private isAnalyzeRequest(input: LlmStructuredRequest): boolean {
    const schema = input.responseJsonSchema as { required?: string[] };
    return schema.required?.includes('learnerProfile') ?? false;
  }

  private isAnalyzeFallbackRequest(input: LlmStructuredRequest): boolean {
    const schema = input.responseJsonSchema as { required?: string[] };
    return schema.required?.includes('fallbackProfileSummary') ?? false;
  }

  private buildAnalyzeFallbackResponse(userPrompt: string): LlmStructuredResponse {
    const reduced = /reduced=true/.test(userPrompt);
    const summary = reduced
      ? 'Profil simplifié : apprenant autonome, objectif général.'
      : 'Profil de secours : parcours varié, préférences non détaillées — tu pourras affiner plus tard.';
    const payload = {
      fallbackProfileSummary: summary,
      requiresUserConfirmation: true,
    };
    return { rawText: JSON.stringify(payload), parsedJson: payload };
  }

  private buildAnalyzeResponse(): LlmStructuredResponse {
    const payload = {
      learnerProfile: { ...MOCK_LEARNER_PROFILE },
      summaryForUser:
        'Profil mock : étudiant en sciences, objectif examen, explications pas à pas.',
    };
    return {
      rawText: JSON.stringify(payload),
      parsedJson: payload,
    };
  }

  private buildValidateResponse(userPrompt: string): LlmStructuredResponse {
    if (userPrompt.includes('[FALLBACK_MODE')) {
      const reduced = /reduced=true/.test(userPrompt);
      const answerText = extractLearnerAnswer(userPrompt);
      const base = summarizeAnswer(answerText);
      const fallbackSummary = reduced
        ? `Résumé court : ${base.slice(0, 40)}`
        : `Ce que j’ai compris : ${base}`;
      const payload = {
        valid: false,
        fallbackSummary,
        reason: 'max_attempts',
      };
      return { rawText: JSON.stringify(payload), parsedJson: payload };
    }

    const answerText = extractLearnerAnswer(userPrompt);
    const vague = isVagueAnswer(answerText);

    if (!vague) {
      const payload = {
        valid: true,
        turnSummary: summarizeAnswer(answerText),
      };
      return { rawText: JSON.stringify(payload), parsedJson: payload };
    }

    const payload = {
      valid: false,
      rephrasedQuestion:
        'Tu es plutôt étudiant, en reconversion professionnelle, ou tu apprends de ton côté ?',
      reason: 'too_vague',
    };
    return { rawText: JSON.stringify(payload), parsedJson: payload };
  }
}

function extractJsonArrayAfterMarker(
  userPrompt: string,
  marker: string,
): string[] {
  const markerIndex = userPrompt.indexOf(marker);
  if (markerIndex < 0) {
    return [];
  }
  const jsonStart = markerIndex + marker.length;
  const jsonEnd = userPrompt.indexOf('\n', jsonStart);
  const jsonText =
    jsonEnd >= 0 ? userPrompt.slice(jsonStart, jsonEnd) : userPrompt.slice(jsonStart);
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    return [];
  }
  return [];
}

function extractLearnerAnswer(userPrompt: string): string {
  const marker = 'Learner answer:';
  const index = userPrompt.indexOf(marker);
  if (index < 0) {
    return userPrompt.trim();
  }
  return userPrompt.slice(index + marker.length).trim();
}

function isVagueAnswer(answerText: string): boolean {
  const normalized = answerText.trim().toLowerCase();
  if (normalized.length < 12) {
    return true;
  }
  return /^(euh|oui|non|ok|bof)\.?$/i.test(normalized);
}

function summarizeAnswer(answerText: string): string {
  const trimmed = answerText.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return `${trimmed.slice(0, 117)}...`;
}
