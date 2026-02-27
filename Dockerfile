FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ src/
COPY drizzle.config.ts tsconfig.json ./

ENV NODE_ENV=production

# Expose port
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
