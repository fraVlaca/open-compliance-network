FROM oven/bun:1.3

WORKDIR /app

# Install deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source
COPY src/ src/

# Workflows + secrets mounted as volumes (see docker-compose.yml)
ENV PORT=3001
ENV PROJECT_ROOT=/app
ENV CRE_CLI_PATH=/root/.cre/bin/cre

EXPOSE 3001
CMD ["bun", "run", "src/server.ts"]
