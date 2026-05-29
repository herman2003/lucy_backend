/** Default Gemini embedding model for document RAG (SPEC Q10). */
export const GEMINI_EMBEDDING_MODEL_DEFAULT = 'gemini-embedding-001';

/**
 * Stored / indexed vector size ({@link GEMINI_EMBEDDING_MODEL_DEFAULT} with MRL truncation).
 * Use this when configuring Firestore vector indexes (see backend/README.md).
 */
export const EMBEDDING_VECTOR_DIMENSION = 768;
