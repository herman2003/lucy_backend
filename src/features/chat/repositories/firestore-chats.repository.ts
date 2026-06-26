import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type { PersistedChatMessage, PersistedChatThread } from '../domain/chat.types';
import type { LastLearningGenerationRequest } from '../domain/last-learning-generation-request.types';
import type { PendingLearningGeneration } from '../domain/pending-learning-generation.types';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import type {
  ChatsRepository,
  ListChatMessagesOptions,
} from './chats.repository.port';

type FirestoreChatThreadData = {
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string;
  pendingLearningGeneration?: PendingLearningGeneration;
  corpusStudyPlan?: CorpusStudyPlan;
  lastLearningGenerationRequest?: LastLearningGenerationRequest;
  revisionExamDate?: string;
};

type FirestoreChatMessageData = {
  role: PersistedChatMessage['role'];
  content: string;
  createdAt: string;
  status?: PersistedChatMessage['status'];
  sources?: PersistedChatMessage['sources'];
};

@Injectable()
export class FirestoreChatsRepository implements ChatsRepository {
  async createThread(uid: string, title: string): Promise<PersistedChatThread> {
    const ref = this.chatsCollection(uid).doc();
    const now = new Date().toISOString();
    const data: FirestoreChatThreadData = {
      title,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(data);
    return { id: ref.id, uid, ...data };
  }

  async listThreads(uid: string): Promise<PersistedChatThread[]> {
    const snapshot = await this.chatsCollection(uid)
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs.map((doc) =>
      this.toThread(uid, doc.id, doc.data() as FirestoreChatThreadData),
    );
  }

  async getThread(uid: string, chatId: string): Promise<PersistedChatThread | null> {
    const snapshot = await this.chatsCollection(uid).doc(chatId).get();
    if (!snapshot.exists) {
      return null;
    }
    return this.toThread(uid, chatId, snapshot.data() as FirestoreChatThreadData);
  }

  async listMessages(
    uid: string,
    chatId: string,
    options: ListChatMessagesOptions,
  ): Promise<PersistedChatMessage[]> {
    const threadRef = this.chatsCollection(uid).doc(chatId);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) {
      return [];
    }

    const messagesCol = threadRef.collection('messages');

    if (options.beforeMessageId !== undefined) {
      const beforeSnap = await messagesCol.doc(options.beforeMessageId).get();
      if (!beforeSnap.exists) {
        return [];
      }
      const beforeAt = (beforeSnap.data() as FirestoreChatMessageData).createdAt;
      const snapshot = await messagesCol
        .where('createdAt', '<', beforeAt)
        .orderBy('createdAt', 'desc')
        .limit(options.limit)
        .get();
      return snapshot.docs
        .map((doc) => this.toMessage(chatId, doc.id, doc.data() as FirestoreChatMessageData))
        .reverse();
    }

    const snapshot = await messagesCol
      .orderBy('createdAt', 'desc')
      .limit(options.limit)
      .get();
    return snapshot.docs
      .map((doc) => this.toMessage(chatId, doc.id, doc.data() as FirestoreChatMessageData))
      .reverse();
  }

  async appendMessage(
    uid: string,
    chatId: string,
    message: Omit<PersistedChatMessage, 'chatId'>,
  ): Promise<PersistedChatMessage> {
    const threadRef = this.chatsCollection(uid).doc(chatId);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) {
      throw new Error(`Chat thread not found: ${chatId}`);
    }

    const messageRef = message.id
      ? threadRef.collection('messages').doc(message.id)
      : threadRef.collection('messages').doc();

    const messageData: FirestoreChatMessageData = {
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.status !== undefined ? { status: message.status } : {}),
      ...(message.sources !== undefined ? { sources: message.sources } : {}),
    };

    const batch = admin.firestore().batch();
    batch.set(messageRef, messageData);
    batch.set(
      threadRef,
      {
        updatedAt: message.createdAt,
        lastMessagePreview: message.content.slice(0, 120),
      },
      { merge: true },
    );
    await batch.commit();

    return {
      chatId,
      id: messageRef.id,
      ...messageData,
    };
  }

  async patchThread(
    uid: string,
    chatId: string,
    patch: {
      title?: string;
      pendingLearningGeneration?: PendingLearningGeneration | null;
      corpusStudyPlan?: CorpusStudyPlan | null;
      lastLearningGenerationRequest?: LastLearningGenerationRequest | null;
      revisionExamDate?: string | null;
    },
  ): Promise<void> {
    const threadRef = this.chatsCollection(uid).doc(chatId);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) {
      throw new Error(`Chat thread not found: ${chatId}`);
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (patch.title !== undefined) {
      updates.title = patch.title;
    }
    if (patch.pendingLearningGeneration !== undefined) {
      if (patch.pendingLearningGeneration === null) {
        updates.pendingLearningGeneration = admin.firestore.FieldValue.delete();
      } else {
        updates.pendingLearningGeneration = patch.pendingLearningGeneration;
      }
    }
    if (patch.corpusStudyPlan !== undefined) {
      if (patch.corpusStudyPlan === null) {
        updates.corpusStudyPlan = admin.firestore.FieldValue.delete();
      } else {
        updates.corpusStudyPlan = patch.corpusStudyPlan;
      }
    }
    if (patch.lastLearningGenerationRequest !== undefined) {
      if (patch.lastLearningGenerationRequest === null) {
        updates.lastLearningGenerationRequest = admin.firestore.FieldValue.delete();
      } else {
        updates.lastLearningGenerationRequest = patch.lastLearningGenerationRequest;
      }
    }
    if (patch.revisionExamDate !== undefined) {
      if (patch.revisionExamDate === null) {
        updates.revisionExamDate = admin.firestore.FieldValue.delete();
      } else {
        updates.revisionExamDate = patch.revisionExamDate;
      }
    }
    await threadRef.set(updates, { merge: true });
  }

  async deleteThread(uid: string, chatId: string): Promise<void> {
    const threadRef = this.chatsCollection(uid).doc(chatId);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) {
      throw new Error(`Chat thread not found: ${chatId}`);
    }

    const messagesSnap = await threadRef.collection('messages').get();
    const batch = admin.firestore().batch();
    for (const doc of messagesSnap.docs) {
      batch.delete(doc.ref);
    }
    batch.delete(threadRef);
    await batch.commit();
  }

  private chatsCollection(uid: string): admin.firestore.CollectionReference {
    return admin.firestore().collection('users').doc(uid).collection('chats');
  }

  private toThread(
    uid: string,
    id: string,
    data: FirestoreChatThreadData,
  ): PersistedChatThread {
    return {
      id,
      uid,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      ...(data.lastMessagePreview !== undefined
        ? { lastMessagePreview: data.lastMessagePreview }
        : {}),
      ...(data.pendingLearningGeneration !== undefined
        ? { pendingLearningGeneration: data.pendingLearningGeneration }
        : {}),
      ...(data.corpusStudyPlan !== undefined
        ? { corpusStudyPlan: data.corpusStudyPlan }
        : {}),
      ...(data.lastLearningGenerationRequest !== undefined
        ? { lastLearningGenerationRequest: data.lastLearningGenerationRequest }
        : {}),
      ...(data.revisionExamDate !== undefined
        ? { revisionExamDate: data.revisionExamDate }
        : {}),
    };
  }

  private toMessage(
    chatId: string,
    id: string,
    data: FirestoreChatMessageData,
  ): PersistedChatMessage {
    return {
      id,
      chatId,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt,
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sources !== undefined ? { sources: data.sources } : {}),
    };
  }
}
