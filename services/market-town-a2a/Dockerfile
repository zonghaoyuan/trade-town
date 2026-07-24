FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV A2A_PORT=41241
EXPOSE 41241

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${A2A_PORT}/healthz" >/dev/null || exit 1

CMD ["npm", "run", "a2a:dev"]
