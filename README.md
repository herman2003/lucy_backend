# Lucy Backend (NestJS)

HTTP API for learner onboarding (7 Q/A turns, profile analysis, finalize). Product spec: [`../frontend/SPEC.md`](../frontend/SPEC.md) §4.

This folder lives next to the Flutter app (`Lucy/frontend/`). It is **not** part of the frontend git repository.

## Prerequisites

- Node.js 18+ and npm
- Firebase project with **Authentication** and **Firestore**
- [Google AI](https://aistudio.google.com/apikey) API key for Gemini (`GEMINI_API_KEY`)
- Firebase Admin credentials (service account JSON **or** Application Default Credentials)

## Quick start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set GEMINI_API_KEY and uncomment GOOGLE_APPLICATION_CREDENTIALS if needed
npm run start:dev
```

Health check (no auth):

```bash
curl -s http://localhost:3001/health
```

All onboarding routes use the global prefix `v1` and require a Firebase ID token:

`Authorization: Bearer <Firebase idToken>`

## Environment variables

Copy `.env.example` to `.env`. Variables are loaded in `src/core/config/lucy-config.ts`.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default `3001`) | HTTP listen port |
| `NODE_ENV` | No | `development` or `production` |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project id (e.g. `lucy-7504c`) |
| `FIREBASE_STORAGE_BUCKET` | If `STORAGE_PROVIDER=firebase` | GCS bucket (default `{FIREBASE_PROJECT_ID}.appspot.com`) |
| `STORAGE_PROVIDER` | No (default `firebase`) | `r2` or `firebase` — document binary storage |
| `R2_BUCKET` | Yes if `r2` | Cloudflare R2 bucket name (e.g. `lucy`) |
| `R2_ACCOUNT_ID` | Yes if `r2` (or set `R2_ENDPOINT`) | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | Yes if `r2` | R2 S3 API access key |
| `R2_SECRET_ACCESS_KEY` | Yes if `r2` | R2 S3 API secret |
| `R2_ENDPOINT` | No | Default `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com` (use EU URL from dashboard if needed) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Dev typical | Path to service account JSON for Firestore + Storage Admin |
| `FIRESTORE_PROVIDER` | No (dev) | `firebase` (default) or `memory` (local tests without service account) |
| `LLM_PROVIDER` | Yes | `gemini`, `openrouter`, or `mock` (local dev, no LLM API key) |
| `GEMINI_API_KEY` | Yes for embeddings + when `LLM_PROVIDER=gemini` | Server-only secret |
| `GEMINI_MODEL` | No (default `gemini-2.5-flash`) | Gemini model id (direct API) |
| `OPENROUTER_API_KEY` | Yes when `LLM_PROVIDER=openrouter` | [OpenRouter](https://openrouter.ai/keys) server-only secret |
| `OPENROUTER_MODEL` | No (default `google/gemini-2.5-flash`) | OpenRouter model id |
| `OPENROUTER_APP_URL` | No | Optional `HTTP-Referer` header |
| `OPENROUTER_APP_NAME` | No | Optional `X-Title` header |
| `GEMINI_EMBEDDING_MODEL` | No (default `gemini-embedding-001`) | Gemini embedding model for document RAG (**always** used at runtime, not affected by `LLM_PROVIDER`) |
| `CORS_ALLOWED_ORIGINS` | No | Extra allowed browser origins (comma-separated) |

### Document RAG embeddings (D2)

- Runtime: `GeminiEmbeddingAdapter` via `EMBEDDING_PORT` (`src/core/llm/embedding.port.ts`).
- Default model: **`gemini-embedding-001`** with MRL truncation to **768** dimensions (`EMBEDDING_VECTOR_DIMENSION` in `embedding.constants.ts`). Configure Firestore vector indexes with this dimension. (`text-embedding-004` returns 404 on the current API.)
- Unit tests: inject `FakeEmbeddingAdapter` on `EMBEDDING_PORT` (no network, no global mock provider).

#### Firestore vector index (chunks)

After ingestion, each document has a sub-collection:

`users/{uid}/documents/{documentId}/chunks/{chunkId}`

| Field | Type | Notes |
|-------|------|--------|
| `ordinal` | number | Chunk order |
| `text` | string | Markdown fragment |
| `tokenEstimate` | number | Approx. tokens |
| `embedding` | vector | Dimension **768** (`gemini-embedding-001` + `outputDimensionality`) |
| `pageStart`, `pageEnd` | number | Optional (PDF) |

In Firebase console → Firestore → **Indexes** → composite / vector index on collection group **`chunks`**, field **`embedding`** (vector), dimension **768**. Exact UI labels depend on your Firebase project version; align with [Firestore vector search](https://firebase.google.com/docs/firestore/vector-search) docs.

#### Firestore collection-group index (`documents.status`)

`DocumentIngestionService` and `DocumentUploadSweeperService` query **all users** via `collectionGroup('documents').where('status', '==', …)`. Firestore needs a **single-field** index with **`COLLECTION_GROUP`** scope on **`status`** (not a composite entry in `indexes[]` — use `fieldOverrides`).

- Declarative config: [`firestore.indexes.json`](./firestore.indexes.json) (`fieldOverrides` → `documents` / `status` / `COLLECTION_GROUP`).
- Deploy from `frontend/`: `firebase deploy --only firestore:indexes`, or use the link in the Nest error / Firebase Console.
- Until the override is **Built**, the API still starts; stale `processing` / `uploading` sweeps are skipped with a warning log.

Stale `uploading` documents (&gt; 24 h) are marked `failed` with `UPLOAD_ABANDONED` by `DocumentUploadSweeperService` (orphan Storage object removed).

**Secrets must stay on the server.** Never ship `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, or the service account to the Flutter client.

### OpenRouter (`LLM_PROVIDER=openrouter`)

Chat streaming, onboarding, and quiz/flashcards generation use OpenRouter (`fetch` → `https://openrouter.ai/api/v1/chat/completions`). **Embeddings stay on Gemini** — keep `GEMINI_API_KEY` set for document RAG.

```bash
# In .env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.5-flash
GEMINI_API_KEY=...   # still required for embeddings / retrieval
npm run start:dev
```

Switch back to direct Gemini anytime with `LLM_PROVIDER=gemini` (your choice via env only).

### Local dev without Gemini (`LLM_PROVIDER=mock`)

```bash
# In .env
LLM_PROVIDER=mock
# GEMINI_API_KEY can stay empty
npm run start:dev
```

`MockLlmAdapter` returns deterministic validate/analyze JSON so Flutter web + Nest can be exercised before P1 (real `GEMINI_API_KEY`) is configured.

Quick start (all local mocks):

```bash
npm run start:dev:local
curl http://localhost:3001/health
# → dev.localStackReady: true
```

### Local dev without Firebase service account (B08)

```bash
# In .env (never use in production)
LLM_PROVIDER=mock
FIREBASE_AUTH_MODE=dev
FIRESTORE_PROVIDER=memory
npm run start:dev
```

- Auth header: `Authorization: Bearer dev:local-user-1` (any uid after `dev:`).
- Onboarding transcript and profile are stored in memory (lost on restart).
- Flutter still uses real Firebase Auth for signup; point Dio at Nest with the **same uid** only for pure API/curl tests, or configure P2 for full E2E.

### Firebase Admin

- Set `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json` (path to your key file; do not commit the JSON).
- Or use `gcloud auth application-default login` and omit the variable in local dev.
- **Documents (RAG upload)** use **Firestore** for metadata/chunks and **R2 or Firebase Storage** for binaries (`users/{uid}/documents/{docId}/original.{ext}`). The API returns **signed PUT/GET URLs** (~15 min).

#### Cloudflare R2 (recommended — no Firebase Blaze)

Spec: [`../frontend/docs/spec-storage-r2.md`](../frontend/docs/spec-storage-r2.md)

```bash
# backend/.env
STORAGE_PROVIDER=r2
R2_BUCKET=lucy
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com   # EU endpoint from dashboard

FIRESTORE_PROVIDER=firebase
FIREBASE_AUTH_MODE=firebase
npm run start:dev
```

Configure **CORS** on the R2 bucket (Cloudflare dashboard → R2 → `lucy` → Settings → CORS). Paste [`r2.cors.json`](./r2.cors.json) — **`OPTIONS`** and **`AllowedHeaders: ["*"]`** are required for Flutter web PUT preflight.

Bootstrap logs show `"storageProvider":"r2"`. Upload success: `[R2DocumentsStorage] isObjectPresent ok`.

#### Firebase Storage (legacy — requires Blaze plan)

**Flutter web** requires **GCS bucket CORS** (Nest CORS alone is not enough):

```bash
# From frontend/
gsutil cors set storage.cors.json gs://lucy-7504c.firebasestorage.app
```

Set `STORAGE_PROVIDER=firebase` and `FIREBASE_STORAGE_BUCKET` to the exact bucket name.

```bash
# Real Firebase (upload + complete flow)
FIRESTORE_PROVIDER=firebase
FIREBASE_AUTH_MODE=firebase
npm run start:dev
# POST /v1/documents → uploadUrl → PUT binary → POST /v1/documents/:id/complete
```

### Flutter / web client

- The app sends the Firebase **ID token** on each onboarding request.
- **CORS** (SPEC §4.6): enabled in `main.ts` via `buildCorsOptions`.
  - Always allows `http://localhost:*` and `http://127.0.0.1:*` (Flutter web dev).
  - Add deployed web origins in `CORS_ALLOWED_ORIGINS` (comma-separated, exact match).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Watch mode (`nest start --watch`) |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run `node dist/main` |
| `npm test` | Jest unit/integration tests |
| `npm run test:watch` | Jest in watch mode |

## Project layout

```
backend/
├── src/
│   ├── main.ts                 # Global prefix v1, exception filter
│   ├── app.module.ts
│   ├── health/                 # GET /health
│   ├── core/
│   │   ├── auth/               # FirebaseAuthGuard, Admin SDK
│   │   ├── config/             # Env loading
│   │   ├── errors/             # LucyApiError, codes, filter
│   │   ├── llm/                # LlmPort, GeminiLlmAdapter
│   │   └── prompt/             # PromptLoaderService
│   ├── features/
│   │   ├── users/              # GET/POST /v1/users/me
│   │   └── onboarding/         # Controller + service + Firestore repo
│   └── prompts/                # System/user templates (loaded at boot)
├── test/                       # e.g. health.controller.spec.ts
├── .env.example
└── README.md
```

## Users API (`/v1/users/*`)

Protected by `FirebaseAuthGuard`. Flutter uses these routes for signup profile creation and router guards (`isConfigured`).

| Method | Path | Role |
|--------|------|------|
| `GET` | `/v1/users/me` | Read profile + `isConfigured`, `onboardingStatus`, `uiLocale` |
| `POST` | `/v1/users/me` | Create profile at signup (idempotent — **201** created, **200** if doc exists) |

### GET /v1/users/me

```bash
curl -s http://localhost:3001/v1/users/me \
  -H "Authorization: Bearer <Firebase idToken>"
```

Missing fields default to `isConfigured: false`, `onboardingStatus: "not_started"`.

### POST /v1/users/me

```bash
curl -s -X POST http://localhost:3001/v1/users/me \
  -H "Authorization: Bearer <Firebase idToken>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe","email":"jane@example.com"}'
```

| Code | `error` | When |
|------|---------|------|
| 409 | `USER_PROFILE_CONFLICT` | Email/doc owner mismatch |

## Onboarding API (`/v1/onboarding/*`)

Protected by `FirebaseAuthGuard`. Request/response shapes follow SPEC §4.6.

| Method | Path | Role |
|--------|------|------|
| `GET` | `/v1/onboarding/progress` | Resume onboarding (`transcript`, `onboardingStatus`, pending profile) |
| `POST` | `/v1/onboarding/validate-answer` | LLM validates free-text answer; may return `rephrasedQuestion` |
| `POST` | `/v1/onboarding/confirm-turn` | Persist one confirmed turn to Firestore transcript |
| `POST` | `/v1/onboarding/analyze` | Build `learnerProfile` from 7 confirmed turns (LLM) |
| `POST` | `/v1/onboarding/finalize` | User accepts profile → `isConfigured: true` on user doc |

Typical flow: **validate** → user confirms in UI → **confirm-turn** (×7) → **analyze** → user reviews → **finalize** with `{ "accept": true }`.

Bootstrap / resume: **GET progress** (mid-flow transcript) + Flutter local draft mirror (A16).

Question ids (order): `q_role`, `q_domains`, `q_goal`, `q_level`, `q_style`, `q_tone`, `q_language`.

### GET /v1/onboarding/progress

```bash
curl -s http://localhost:3001/v1/onboarding/progress \
  -H "Authorization: Bearer <Firebase idToken>"
```

Returns **200** with `{ "onboardingStatus": "not_started", "transcript": [] }` when the user never started (no 404).

### Error responses

JSON body: `{ "error": "<CODE>", "statusCode": <number>, "message": "<string>" }`.

Codes (see `src/core/errors/lucy-error-codes.ts`):

| Code | Typical HTTP |
|------|----------------|
| `UNAUTHORIZED` | 401 |
| `VALIDATION_ERROR` | 400 |
| `ANSWER_TOO_LONG` | 400 |
| `ONBOARDING_ALREADY_COMPLETE` | 409 |
| `ONBOARDING_TRANSCRIPT_INCOMPLETE` | 422 |
| `ONBOARDING_PROFILE_INCOMPLETE` | 422 |
| `ONBOARDING_PENDING_PROFILE_MISSING` | 422 |
| `LLM_RESPONSE_INVALID` | 502 |
| `LLM_UNAVAILABLE` | 503 |
| `INTERNAL_ERROR` | 500 |

Rate limiting and production logging rules are described in SPEC §4.6 (not all enforced in code yet).

## Manual `curl` examples

Replace `<Firebase idToken>` with a valid token from your test user.

### validate-answer

```bash
curl -s -X POST http://localhost:3001/v1/onboarding/validate-answer \
  -H "Authorization: Bearer <Firebase idToken>" \
  -H "Content-Type: application/json" \
  -d '{"locale":"fr","turn":{"questionId":"q_role","answerText":"Je suis étudiant en L2 biologie."}}'
```

### confirm-turn

```bash
curl -s -X POST http://localhost:3001/v1/onboarding/confirm-turn \
  -H "Authorization: Bearer <Firebase idToken>" \
  -H "Content-Type: application/json" \
  -d '{"locale":"fr","confirmationType":"normal","turn":{"questionId":"q_role","answerText":"Étudiant L2 biologie"}}'
```

### analyze

Requires **7** confirmed turns in Firestore for the uid and a valid `GEMINI_API_KEY`.

```bash
curl -s -X POST http://localhost:3001/v1/onboarding/analyze \
  -H "Authorization: Bearer <Firebase idToken>" \
  -H "Content-Type: application/json" \
  -d '{"locale":"fr"}'
```

### finalize

Requires a pending `learnerProfile` from a successful analyze.

```bash
curl -s -X POST http://localhost:3001/v1/onboarding/finalize \
  -H "Authorization: Bearer <Firebase idToken>" \
  -H "Content-Type: application/json" \
  -d '{"accept":true}'
```

## Firestore (high level)

Per authenticated `uid`:

- `users/{uid}` — `isConfigured`, `learnerProfile`, onboarding metadata
- Onboarding transcript subcollection / fields as implemented in `firebase-user.repository.ts`

Exact field names and enums match SPEC §4 and `src/features/onboarding/domain/`.

## Prompts

Templates under `src/prompts/`:

- `onboarding-validate-answer.system.md` / `.user.hbs`
- `onboarding-analyze.system.md` / `.user.hbs`

Loaded at startup by `PromptLoaderService`. Edit prompts in Git; restart the server to pick up changes.

## Tests

```bash
npm test
```

Covers validators, transcript rules, service flows (validate, confirm, analyze, finalize), auth guard, LLM adapter (mocked), and prompt loading.

## Production notes

- Run `npm run build` then `npm run start:prod`
- Configure secrets via your host (not committed `.env`)
- Do not log raw `answerText` in production logs (SPEC §4.6)
