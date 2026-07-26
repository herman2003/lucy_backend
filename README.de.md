# Lucy Backend (NestJS)

[English](./README.md) · [Deutsch](./README.de.md)

HTTP-API für **Lucy**: Onboarding, Dokumente/RAG, Chat (SSE), Quiz/Karteikarten, Erinnerungen.

| | |
|---|---|
| **Live-API** | https://lucy-api-yo4k.onrender.com |
| **Health** | https://lucy-api-yo4k.onrender.com/health |
| **Frontend (Web)** | https://lucy-7504c.web.app |
| **Frontend-Repo** | https://github.com/herman2003/lucy_frontend |
| **Dieses Repo** | https://github.com/herman2003/lucy_backend |

> Kostenlose Render-Instanzen schlafen nach Inaktivität. Der erste Aufruf danach kann 30–60 Sekunden dauern.

## Voraussetzungen

- Node.js 18+ und npm
- Firebase-Projekt (Auth + Firestore)
- `GEMINI_API_KEY`
- Firebase Admin Service-Account (JSON)

## Schnellstart

```bash
npm install
cp .env.example .env
# .env ausfüllen
npm run start:dev
curl -s http://localhost:3001/health
```

## Docker / Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

## Deploy (Render)

Siehe [`render.yaml`](./render.yaml). Secrets aus `.env.example` setzen.  
Wichtig: `GOOGLE_APPLICATION_CREDENTIALS_JSON` = **Inhalt** der Service-Account-JSON-Datei (kein Dateipfad).

Live: https://lucy-api-yo4k.onrender.com

## Tests

```bash
npm test
```

Ausführliche Doku (Env, RAG, Endpoints): [README.md](./README.md) (Englisch).

---

*Dieses Dokument wurde mit Cursor (KI) erstellt.*
