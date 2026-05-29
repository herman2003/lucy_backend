import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { parseCreateDocumentRequest } from './dto/create-document.dto';
import type { CreateDocumentResponseDto } from './dto/create-document-response.dto';
import type { DocumentDetailDto } from './dto/document-detail.dto';
import type { DocumentDownloadResponseDto } from './dto/document-download-response.dto';
import type { DocumentListItemDto } from './dto/document-list-item.dto';
import { parsePatchDocumentRequest } from './dto/patch-document.dto';
import { DocumentsService } from './services/documents.service';

@Controller('documents')
@UseGuards(FirebaseAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async createDocument(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
  ): Promise<CreateDocumentResponseDto> {
    const uid = this.requireUid(request);
    const input = parseCreateDocumentRequest(body);
    return this.documentsService.create(uid, input);
  }

  @Get()
  async listDocuments(
    @Req() request: FirebaseAuthRequest,
  ): Promise<DocumentListItemDto[]> {
    const uid = this.requireUid(request);
    return this.documentsService.list(uid);
  }

  @Get(':id')
  async getDocument(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
  ): Promise<DocumentDetailDto> {
    const uid = this.requireUid(request);
    return this.documentsService.getById(uid, id);
  }

  @Post(':id/upload')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadDocumentFile(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<void> {
    const uid = this.requireUid(request);
    if (!file?.buffer?.length) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.VALIDATION_ERROR,
        'Multipart field "file" is required',
      );
    }
    const mimeType = file.mimetype?.trim() || 'application/octet-stream';
    await this.documentsService.uploadObject(uid, id, file.buffer, mimeType);
  }

  @Post(':id/reprocess')
  async reprocessDocument(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
  ): Promise<{ id: string; status: string }> {
    const uid = this.requireUid(request);
    return this.documentsService.reprocess(uid, id);
  }

  @Post(':id/complete')
  async completeDocument(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
  ): Promise<{ id: string; status: string }> {
    const uid = this.requireUid(request);
    return this.documentsService.complete(uid, id);
  }

  @Get(':id/download')
  async downloadDocument(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
  ): Promise<DocumentDownloadResponseDto> {
    const uid = this.requireUid(request);
    return this.documentsService.getDownloadUrl(uid, id);
  }

  @Patch(':id')
  async patchDocument(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<DocumentDetailDto> {
    const uid = this.requireUid(request);
    const input = parsePatchDocumentRequest(body);
    return this.documentsService.setSearchEnabled(uid, id, input.searchEnabled);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Req() request: FirebaseAuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    const uid = this.requireUid(request);
    await this.documentsService.delete(uid, id);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return uid;
  }
}

