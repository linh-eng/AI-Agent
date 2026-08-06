# ---- Ảnh chạy webapp THNG (Next.js + Prisma) ----
FROM node:20-bookworm-slim

# Prisma cần openssl
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài dependencies (gồm cả devDependencies để build được)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Mã nguồn + build production
COPY . .
RUN npm run build

# Chạy ở chế độ production
ENV NODE_ENV=production
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
