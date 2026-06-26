# Spec — Normalisation des réponses LLM (quiz / cartes)

> **Statut** : en cours d’implémentation  
> **Périmètre** : `lucy_backend` — génération learning sessions  
> **Lié** : [spec-openrouter-llm.md](./spec-openrouter-llm.md), [spec-learning-generation.md](../../lucy_frontend/docs/spec-learning-generation.md)

---

## 1. Objectif

Garantir que la génération quiz/cartes **fonctionne** même quand le LLM (Gemini direct ou OpenRouter) ne respecte pas strictement le JSON Schema, en normalisant les variantes courantes **avant** validation stricte.

### Utilisateurs

| Persona | Besoin |
|---------|--------|
| Apprenant | « génère un quiz » dans le chat → session jouable |
| Dev / ops | Moins d’échecs `LEARNING_GENERATION_FAILED` dus au format JSON |

### Problème observé

Le validateur attend :

```json
{
  "items": [
    {
      "question": "...",
      "choices": ["A", "B", "C", "D"],
      "correctIndex": 1,
      "explanation": "...",
      "sourceChunkIds": ["chunk_xyz"]
    }
  ]
}
```

Gemini renvoie souvent d’autres formes :

| Variante | Exemple |
|----------|---------|
| Tableau racine | `[ { question, options } ]` |
| Clé `quiz_questions` | `{ "quiz_title": "...", "quiz_questions": [ ... ] }` |
| Champs verbeux | `question_text`, `question_choices`, `choice_text` |
| Booléen snake_case | `is_correct` au lieu de `correctIndex` |
| Sources absentes | pas de `sourceChunkIds` malgré extraits fournis |

---

## 2. Décisions validées

| # | Décision |
|---|----------|
| D1 | **Canonisme unique** côté validateur (`items` + `choices` + `correctIndex`) |
| D2 | **Couche normalisation** avant validation (`generated-quiz-normalizer.ts`) |
| D3 | **Fallback `sourceChunkIds`** : si absent après normalisation, utiliser le **premier** `chunkId` des hits retrieval (corpus réel) |
| D4 | **Retry** : 2 tentatives LLM inchangées ; normalisation à chaque tentative |
| D5 | `LLM_PROVIDER=openrouter` recommandé ; Gemini direct sujet aux 503 et drift JSON |
| D6 | Embeddings **toujours Gemini** (`GEMINI_API_KEY`) |

---

## 3. Matrice de normalisation (quiz)

### Enveloppe racine

| Entrée LLM | Sortie canonique |
|------------|------------------|
| `[...]` | `{ items: [...] }` |
| `{ items: [...] }` | inchangé |
| `{ questions: [...] }` | `{ items: questions }` |
| `{ quiz_questions: [...] }` | `{ items: quiz_questions }` |
| `{ quiz: [...] }` | `{ items: quiz }` |

### Champs par question

| Entrée | Canonique |
|--------|-----------|
| `question_text`, `questionText` | `question` |
| `options`, `answers`, `question_choices` | `choices` (+ `correctIndex`) |
| `choice_text`, `text` dans option | élément de `choices` |
| `isCorrect`, `is_correct`, `correct` | déduit `correctIndex` |
| `explanation`, `rationale`, `feedback` | `explanation` (défaut si absent) |
| `source_chunk_ids`, `chunkIds` | `sourceChunkIds` |
| *(absent)* + hits retrieval | `sourceChunkIds: [hits[0].chunkId]` |

---

## 4. Structure projet

```
src/features/learning-sessions/validators/
  generated-quiz-normalizer.ts      # normalisation (quiz)
  generated-quiz-normalizer.spec.ts
  generated-quiz.validator.ts     # validation stricte post-normalisation
  generated-flashcards.validator.ts # idem cartes (phase 2 si besoin)
```

---

## 5. Commandes

```bash
cd lucy_backend
npm test -- generated-quiz

# Config recommandée
# LLM_PROVIDER=openrouter
# OPENROUTER_API_KEY=...
# GEMINI_API_KEY=...   # embeddings
npm run start:dev
```

---

## 6. Tests

| Cas | Attendu |
|-----|---------|
| Payload canonique | passe sans modification |
| Tableau racine + `options` | `items` + `choices` + `correctIndex` |
| `quiz_questions` + `question_choices` | idem |
| `sourceChunkIds` absent + hits | fallback premier chunk |
| Mauvais nombre d’items | `expected N quiz items` |
| Chunk inconnu | `references unknown chunkId` |

---

## 7. Boundaries

| | Règle |
|---|--------|
| **Toujours** | Valider strictement après normalisation ; ne jamais afficher JSON brut en UI |
| **Demander** | Assouplir le nombre d’items ; accepter 3 choix au lieu de 4 |
| **Jamais** | Inventer des chunkIds hors corpus retrieval |

---

## 8. Critères d’acceptation

- [x] Normalise `quiz_questions` / `question_text` / `question_choices`
- [x] Fallback `sourceChunkIds` depuis hits retrieval
- [ ] Checklist manuelle : « génère un quiz » OK avec `LLM_PROVIDER=openrouter`
- [ ] Checklist manuelle : idem avec `LLM_PROVIDER=gemini` quand API disponible

---

*Ce document a été créé avec Cursor (IA).*
