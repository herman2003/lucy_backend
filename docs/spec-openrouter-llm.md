# Spec — Provider LLM OpenRouter (backend)

> **Statut** : **implémenté** (MVP) — décisions validées 2026-06-10  
> **Périmètre** : `lucy_backend` uniquement (aucun changement Flutter)  
> **Contexte** : aujourd’hui `LLM_PROVIDER=gemini|mock` ; `openai` est typé mais **non implémenté**. Les embeddings RAG restent **toujours Gemini**.

---

## 1. Objectif

Permettre d’utiliser **OpenRouter** comme fournisseur LLM (chat streaming, onboarding structuré, génération quiz/cartes) via une clé serveur dédiée, **sans exposer la clé au client Flutter**.

### Utilisateurs cibles

| Persona | Besoin |
|---------|--------|
| Développeur local | Contourner une clé Gemini directe défaillante ou tester d’autres modèles |
| Ops / staging | Un seul agrégateur (OpenRouter) pour plusieurs modèles |
| Production (optionnel) | Bascule `LLM_PROVIDER=openrouter` sans refactor des features |

### Problème résolu

Erreurs `LLM_UNAVAILABLE: Gemini streaming request failed` quand l’API Google Generative AI est indisponible, mal configurée ou bloquée — tout en **conservant Gemini pour les embeddings** documentaires (déjà en place).

### Hors scope (MVP)

- Choix du provider/modèle dans l’app Paramètres
- Embeddings via OpenRouter
- Fallback automatique Gemini → OpenRouter
- Facturation / quotas OpenRouter côté produit

---

## 2. Analyse de l’existant

### Architecture actuelle

```
Features (chat, onboarding, learning-sessions)
        │
        ├── LLM_STREAMING_PORT  →  GeminiLlmStreamingAdapter | MockLlmStreamingAdapter
        └── LLM_PORT            →  GeminiLlmAdapter         | MockLlmAdapter

EMBEDDING_PORT (toujours)       →  GeminiEmbeddingAdapter
```

| Fichier | Rôle |
|---------|------|
| `src/core/llm/llm.port.ts` | `generateStructured({ systemPrompt, userPrompt, responseJsonSchema })` |
| `src/core/llm/llm-streaming.port.ts` | `streamText({ systemPrompt, userPrompt })` → `AsyncIterable<string>` |
| `src/core/llm/llm.module.ts` | Factory `LLM_PROVIDER` → adapter |
| `src/core/config/lucy-config.ts` | `geminiApiKey`, `geminiModel`, `llmProvider` |
| `.env.example` | `LLM_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL` |

### Consommateurs de `LLM_PORT` (structuré)

- Onboarding (`validate`, `analyze`, finalize)
- Learning sessions (quiz + flashcards)
- Chat RAG (citations fallback — `generateStructured`)

### Consommateurs de `LLM_STREAMING_PORT`

- Chat stream (`ChatStreamService.completeTurn`)

### OpenRouter — compatibilité

- API **OpenAI-compatible** : `POST https://openrouter.ai/api/v1/chat/completions`
- Auth : `Authorization: Bearer OPENROUTER_API_KEY`
- Streaming : `stream: true` (SSE OpenAI)
- JSON structuré : `response_format: { type: 'json_schema', json_schema: { name, strict, schema } }`
- Modèles : identifiants OpenRouter (ex. `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4`)

**Contrainte** : le modèle choisi doit supporter `json_schema` pour onboarding et learning-sessions. Documenter un modèle par défaut testé.

---

## 3. Décisions produit (à confirmer)

| # | Sujet | Proposition MVP | Alternative |
|---|--------|-----------------|-------------|
| D1 | Nom du provider | `LLM_PROVIDER=openrouter` | Réutiliser `openai` (moins explicite) |
| D2 | Clé dédiée | `OPENROUTER_API_KEY` | Réutiliser une clé générique |
| D3 | Modèle par défaut | `OPENROUTER_MODEL=google/gemini-2.5-flash` | Autre modèle (Claude, etc.) |
| D4 | Embeddings | **Toujours Gemini** (`GEMINI_API_KEY` requis si corpus RAG) | OpenRouter embeddings (hors scope) |
| D5 | Dépendance HTTP | `fetch` natif Node 18+ (pas de nouveau package) | SDK `openai` pointé vers OpenRouter |
| D6 | Headers OpenRouter | `HTTP-Referer`, `X-Title` optionnels (`OPENROUTER_APP_URL`, `OPENROUTER_APP_NAME`) | Ignorer |

### Décisions validées (2026-06-10)

| # | Décision |
|---|----------|
| D1 | **Coexistence** — bascule manuelle via `LLM_PROVIDER` dans `.env` |
| D2 | `GEMINI_API_KEY` **toujours requis** pour embeddings RAG |
| D3 | Modèle par défaut `google/gemini-2.5-flash` |
| D4 | Client HTTP **`fetch` natif** (pas de SDK `openai`) |

---

## 4. Variables d’environnement

### Nouvelles clés

| Variable | Obligatoire si | Défaut | Description |
|----------|----------------|--------|-------------|
| `OPENROUTER_API_KEY` | `LLM_PROVIDER=openrouter` | — | Clé serveur [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | Non | `google/gemini-2.5-flash` | ID modèle OpenRouter |
| `OPENROUTER_APP_URL` | Non | `http://localhost:3001` | Header `HTTP-Referer` |
| `OPENROUTER_APP_NAME` | Non | `Lucy API` | Header `X-Title` |

### Mise à jour `LLM_PROVIDER`

```env
# gemini | openrouter | mock
LLM_PROVIDER=openrouter

# LLM texte (chat, onboarding, quiz)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.5-flash

# Embeddings RAG — toujours Gemini (indépendant de LLM_PROVIDER)
GEMINI_API_KEY=...
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

### Validation au démarrage

Étendre `validateLucyConfig` :

- Si `llmProvider === 'openrouter'` et `OPENROUTER_API_KEY` vide → **fail fast** avec message explicite.
- Si `firestoreProvider !== 'memory'` et embeddings actifs : avertir si `GEMINI_API_KEY` vide (RAG / chat / quiz impossibles sans corpus indexé).

Étendre `describeDevStack` :

- `openRouterConfigured: boolean`
- Ne pas confondre avec `geminiConfigured` (embeddings).

---

## 5. Structure projet (fichiers à créer / modifier)

### Nouveaux fichiers

```
src/core/llm/
  openrouter.client.ts              # fetch chat/completions (stream + non-stream)
  openrouter.llm.adapter.ts         # impl LlmPort
  openrouter.llm-streaming.adapter.ts
  openrouter.llm.adapter.spec.ts
  openrouter.llm-streaming.adapter.spec.ts
  openrouter.client.spec.ts         # mocks fetch
```

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `lucy-config.ts` | `LlmProvider` += `'openrouter'` ; champs config OpenRouter |
| `llm.module.ts` | Factory branches `openrouter` |
| `.env.example` | Nouvelles variables + commentaires |
| `README.md` | Table env, section OpenRouter |
| `health` / `describeDevStack` | Flags `openRouterConfigured` |

### Aucun changement Flutter

Le client consomme toujours les mêmes endpoints ; les codes erreur restent `LLM_UNAVAILABLE`, `LLM_RESPONSE_INVALID`, etc.

---

## 6. Design technique des adapters

### Client partagé `OpenRouterClient`

```typescript
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

createCompletion(params: {
  model: string;
  messages: ChatMessage[];
  stream?: false;
  responseFormat?: { type: 'json_schema'; schema: object; name: string };
}): Promise<{ content: string }>;

streamCompletion(params: {
  model: string;
  messages: ChatMessage[];
}): AsyncIterable<string>;
```

- Base URL : `https://openrouter.ai/api/v1`
- Mapper `LlmStructuredRequest` :
  - `system` → message `role: system`
  - `userPrompt` → message `role: user`
  - `responseJsonSchema` → `response_format.json_schema` (`name: 'lucy_structured'`, `strict: true`)
- Erreurs :
  - Clé absente → `LLM_UNAVAILABLE` (message : `OpenRouter API key is not configured`)
  - HTTP 4xx/5xx ou chunk SSE `error` → `LLM_UNAVAILABLE` + **log détaillé** (cause Gemini actuelle)
  - JSON invalide après réponse → `LLM_RESPONSE_INVALID`

### Streaming

- Parser SSE OpenAI (`data: {...}\n\n`, ignorer `data: [DONE]` et commentaires `: OPENROUTER`)
- Agréger `choices[0].delta.content`
- Gérer les erreurs mid-stream (OpenRouter envoie parfois HTTP 200 + chunk `error`)

### Mapping modèle Gemini → OpenRouter

| Gemini direct (`GEMINI_MODEL`) | OpenRouter (`OPENROUTER_MODEL`) |
|-------------------------------|----------------------------------|
| `gemini-2.5-flash` | `google/gemini-2.5-flash` |

Documenter la correspondance dans le README (pas de conversion automatique cross-provider).

---

## 7. Commandes (dev / CI)

```bash
# Backend — provider OpenRouter
cd lucy_backend
cp .env.example .env
# LLM_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-or-...
# GEMINI_API_KEY=...   # toujours pour embeddings

npm run start:dev

# Tests unitaires adapters
npm test -- openrouter llm.module

# Test manuel chat
curl -N -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Bonjour"}' \
  http://localhost:3001/v1/chats/$CHAT_ID/messages/stream
```

---

## 8. Stratégie de tests

| Niveau | Contenu |
|--------|---------|
| Unit | `OpenRouterClient` — mock `global.fetch` (200 JSON, stream SSE, 401, chunk error) |
| Unit | Adapters — clé manquante, JSON valide/invalide, deltas stream |
| Unit | `llm.module` — `LLM_PROVIDER=openrouter` résout les bons adapters |
| Unit | `loadLucyConfig` — parsing env OpenRouter |
| Intégration | Réutiliser specs chat-stream / learning-sessions avec **override** `LLM_PORT` (pas d’appel réseau OpenRouter en CI) |
| Manuel | Checklist : chat stream, « génère un quiz », onboarding turn — avec vraie clé OpenRouter |

**Pas de tests e2e réseau OpenRouter en CI** (clé secrète, flaky).

---

## 9. Style & conventions

- Suivre le pattern des adapters Gemini / Mock existants.
- Logger NestJS sur échecs HTTP (comme `GeminiEmbeddingAdapter`).
- Erreurs métier : uniquement `LucyApiError` + `LucyErrorCodes` (pas de message brut côté Flutter).
- Pas de clé OpenRouter dans le code source ni le client Flutter.
- Pas de nouvelle dépendance npm sauf décision explicite (D5).

---

## 10. Boundaries (toujours / demander / jamais)

| | Règle |
|---|--------|
| **Toujours** | Clés LLM côté serveur uniquement ; respecter `LlmPort` / `LlmStreamingPort` ; tests sans réseau en CI |
| **Demander d’abord** | Embeddings via OpenRouter ; fallback multi-provider ; choix modèle par utilisateur ; nouvelle dépendance npm |
| **Jamais** | Exposer `OPENROUTER_API_KEY` au Flutter ; bypass des ports LLM depuis une feature ; supprimer le support Gemini direct |

---

## 11. Critères d’acceptation (MVP)

- [x] `LLM_PROVIDER=openrouter` démarre sans erreur si `OPENROUTER_API_KEY` est définie
- [ ] Chat SSE : réponse streamée via OpenRouter (checklist manuelle)
- [ ] Onboarding : `generateStructured` retourne JSON valide (checklist manuelle)
- [ ] Learning sessions : génération quiz et flashcards OK (checklist manuelle)
- [x] `LLM_PROVIDER=mock` inchangé ; `LLM_PROVIDER=gemini` inchangé
- [x] Embeddings / retrieval inchangés (`GEMINI_API_KEY` + `GeminiEmbeddingAdapter`)
- [x] `.env.example` et `README.md` à jour
- [x] Logs utiles en cas d’échec OpenRouter (status HTTP + message API)
- [x] `npm test` vert (unit)

---

## 12. Plan d’implémentation (tâches)

| Id | Tâche | Estimation |
|----|--------|------------|
| OR-01 | Config : `openrouter` dans `LlmProvider` + env vars + validation | S |
| OR-02 | `OpenRouterClient` (fetch, stream parser, errors) | M |
| OR-03 | `OpenRouterLlmAdapter` + `OpenRouterLlmStreamingAdapter` | M |
| OR-04 | Wiring `llm.module.ts` + `describeDevStack` | S |
| OR-05 | Tests unitaires + `.env.example` + README | M |
| OR-06 | Checklist manuelle dev | S |

---

## 13. Risques

| Risque | Mitigation |
|--------|------------|
| Modèle sans `json_schema` | Documenter modèles supportés ; erreur `LLM_RESPONSE_INVALID` claire |
| Coût / latence OpenRouter | Hors scope produit ; monitoring ops |
| `GEMINI_API_KEY` oubliée avec OpenRouter | Validation + README : embeddings toujours Gemini |
| Différences JSON schema Gemini vs OpenRouter | Tests avec schémas réels (quiz, onboarding) |

---

*Ce document a été créé avec Cursor (IA).*
