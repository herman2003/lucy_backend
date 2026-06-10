# CP-CHAT-1 — Checklist manuelle (backend chat SSE)

Validation humaine après **CHAT-06** (backend prêt pour Flutter CHAT-07).

## Prérequis

- Backend : `cd backend && npm run start:dev:local`
- Firebase Auth (mode dev ou token réel)
- Utilisateur avec onboarding finalisé (`learnerProfile` sur `users/{uid}`)
- Au moins un document `status=ready` et `searchEnabled=true`

## 1. Éligibilité

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/chats/eligibility
```

Attendu : `{ "canChat": true, "activeDocumentCount": >= 1 }`

## 2. Créer un fil

```bash
CHAT_ID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3001/v1/chats | jq -r '.id')
echo "$CHAT_ID"
```

## 3. Stream SSE (cœur CP-CHAT-1)

```bash
curl -N -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Qu est-ce que l entropie ?"}' \
  "http://localhost:3001/v1/chats/${CHAT_ID}/messages/stream"
```

Vérifier la séquence :

- [ ] `event: user_message`
- [ ] Un ou plusieurs `event: text_delta`
- [ ] Commentaires `: ping` environ toutes les 15 s si la génération est longue
- [ ] `event: sources` (tableau vide ou avec citations)
- [ ] `event: done` avec `assistantMessage.status` = `completed`

## 4. Endpoint JSON debug (tests Nest)

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Autre question"}' \
  "http://localhost:3001/v1/chats/${CHAT_ID}/messages"
```

Attendu : `{ "userMessage": {...}, "assistantMessage": { "status": "completed", "sources": [...] } }`

## 5. Garde corpus (409 avant SSE)

Désactiver tous les documents (`searchEnabled=false`), puis :

```bash
curl -i -X POST .../messages/stream
```

Attendu : **409** JSON `CHAT_NO_ACTIVE_DOCUMENTS` (pas de `text/event-stream`).

## 6. Stream concurrent (409)

Lancer deux `curl -N .../stream` sur le même `CHAT_ID` en parallèle.

Attendu : le second reçoit **409** `CHAT_STREAM_IN_PROGRESS` (JSON, pas de flux).

## 7. Suppression de fil

```bash
curl -i -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/v1/chats/${CHAT_ID}"
```

Attendu : **204** ou **200** ; `GET .../messages` → **404** `CHAT_NOT_FOUND`.

Pendant un stream actif : **409** `CHAT_STREAM_IN_PROGRESS`.

## 8. Auth

```bash
curl -i -X POST .../messages/stream
# sans Authorization
```

Attendu : **401** `UNAUTHORIZED`

## 9. Quiz (orientation)

Question : « Génère-moi un quiz sur ce chapitre »

Attendu : réponse texte Lucy orientant vers l’onglet Quiz — pas de JSON quiz.

## Citations (MVP)

- MVP : flux texte + passe structurée `citedChunkIds` (fallback §8.2 spec).
- Tool calling Gemini même tour : phase ultérieure si besoin.

---

*Ce document a été créé avec Cursor (IA).*
