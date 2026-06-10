import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { parseSearchRetrievalRequest } from './dto/search-retrieval.dto';
import type { SearchRetrievalHitDto } from './dto/search-retrieval.dto';
import { RetrievalService } from './services/retrieval.service';

@Controller('retrieval')
@UseGuards(FirebaseAuthGuard)
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('search')
  async search(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
  ): Promise<SearchRetrievalHitDto[]> {
    const uid = this.requireUid(request);
    const input = parseSearchRetrievalRequest(body);
    return this.retrievalService.search(uid, input);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }
}
