# syntax=docker/dockerfile:1

# ---------- Stage 1: build (TypeScript -> dist/) ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- Stage 2: production dependencies only ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Render (and Cloud Run) inject PORT at runtime; default keeps local Docker usable.
ENV PORT=3001

# `nest build` copies src/prompts into dist/prompts (see nest-cli.json assets),
# so the compiled output already contains the Handlebars/Markdown templates.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts/start-prod.mjs ./scripts/start-prod.mjs

EXPOSE 3001
CMD ["node", "scripts/start-prod.mjs"]
