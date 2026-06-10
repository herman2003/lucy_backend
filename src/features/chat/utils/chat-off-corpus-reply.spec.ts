import { buildOffCorpusAssistantReply } from './chat-off-corpus-reply';

describe('buildOffCorpusAssistantReply', () => {
  it('states clearly that the question is not in documents (fr)', () => {
    const reply = buildOffCorpusAssistantReply('fr');

    expect(reply).toContain('ne figure pas dans vos documents');
    expect(reply).not.toMatch(/je suis lucy/i);
    expect(reply).not.toMatch(/mon rôle/i);
  });

  it('returns English copy for en', () => {
    const reply = buildOffCorpusAssistantReply('en');

    expect(reply).toContain('not covered by your documents');
  });
});
