FROM node:24 AS builder

WORKDIR /app

COPY worker/package*.json ./

RUN npm ci

COPY worker/ ./

COPY backend/generated ./generated

RUN npm run build


FROM node:24 AS production

WORKDIR /app

ENV NODE_ENV=production

COPY worker/package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/src/index.js"]