FROM node:24 AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./

RUN npm ci --include=dev --dangerously-allow-all-scripts

COPY backend/ ./

ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bankai

RUN npx prisma generate

RUN npm run build


FROM node:24 AS production

WORKDIR /app

ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/prisma ./prisma

COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts

EXPOSE 5000

CMD ["node", "dist/src/index.js"]
