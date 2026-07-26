import { InMemoryLearningSessionsRepository } from './in-memory-learning-sessions.repository';

describe('InMemoryLearningSessionsRepository (LEARN-01a)', () => {
  let repository: InMemoryLearningSessionsRepository;
  const uid = 'user-learn-01';

  beforeEach(() => {
    repository = new InMemoryLearningSessionsRepository();
  });

  const sampleInput = {
    type: 'quiz' as const,
    status: 'ready' as const,
    itemCount: 2,
    title: 'Quiz · test',
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    activeDocumentCount: 1,
    sourceChatId: 'chat_1',
    items: [
      {
        id: 'item-1',
        question: 'Q1?',
        choices: ['A', 'B', 'C', 'D'] as [string, string, string, string],
        correctIndex: 0,
        explanation: 'Because.',
        sources: [],
      },
    ],
  };

  it('creates and retrieves a session by id', async () => {
    const created = await repository.create(uid, sampleInput);

    expect(created.id).toMatch(/^learn_/);
    expect(created.uid).toBe(uid);

    const loaded = await repository.getById(uid, created.id);
    expect(loaded).toEqual(created);
  });

  it('lists sessions newest first', async () => {
    const older = await repository.create(uid, {
      ...sampleInput,
      title: 'Older',
      createdAt: '2026-05-28T10:00:00.000Z',
      updatedAt: '2026-05-28T10:00:00.000Z',
    });
    const newer = await repository.create(uid, {
      ...sampleInput,
      title: 'Newer',
      createdAt: '2026-05-29T12:00:00.000Z',
      updatedAt: '2026-05-29T12:00:00.000Z',
    });

    const list = await repository.list(uid);
    expect(list.map((s) => s.id)).toEqual([newer.id, older.id]);
  });

  it('returns null for unknown session', async () => {
    expect(await repository.getById(uid, 'missing')).toBeNull();
  });

  it('does not leak sessions across users', async () => {
    const created = await repository.create(uid, sampleInput);
    expect(await repository.getById('other-user', created.id)).toBeNull();
  });

  it('deletes an existing session', async () => {
    const created = await repository.create(uid, sampleInput);
    await repository.delete(uid, created.id);

    expect(await repository.getById(uid, created.id)).toBeNull();
    expect(await repository.list(uid)).toEqual([]);
  });

  it('throws when deleting unknown session', async () => {
    await expect(repository.delete(uid, 'missing')).rejects.toThrow(
      'Learning session not found',
    );
  });
});
