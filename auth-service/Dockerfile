# --- Etapa base: dependencias de produccion ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- Etapa de desarrollo: usada por docker-compose (hot reload con nodemon) ---
FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# --- Etapa final: runtime de produccion ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usuario sin privilegios (buena practica en contenedores)
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY . .

USER nodejs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-4000}/health" || exit 1

CMD ["node", "src/server.js"]
