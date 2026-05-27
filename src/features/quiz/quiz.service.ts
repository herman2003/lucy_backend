import { Injectable } from '@nestjs/common';

import { ChatPrerequisitesService } from '../chat/services/chat-prerequisites.service';
import type { QuizEligibilityDto } from './dto/quiz-eligibility.dto';

@Injectable()
export class QuizService {
  constructor(
    private readonly chatPrerequisites: ChatPrerequisitesService,
  ) {}

  getEligibility(uid: string): Promise<QuizEligibilityDto> {
    return this.chatPrerequisites.getEligibility(uid).then((eligibility) => ({
      canQuiz: eligibility.canChat,
      activeDocumentCount: eligibility.activeDocumentCount,
    }));
  }
}
