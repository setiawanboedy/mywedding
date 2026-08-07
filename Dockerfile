FROM oven/bun:1.3.10-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .
RUN mkdir -p /app/data

ENV APP_PORT=3000
ENV DATABASE_PATH=/app/data/undangan.sqlite
EXPOSE 3000

CMD ["bun", "run", "start"]
