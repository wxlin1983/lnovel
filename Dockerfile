# Stage 1: build the frontend static assets
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# Stage 2: backend runtime, serving the built frontend as static files
FROM python:3.12-slim AS backend
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
COPY backend/app ./app
RUN uv sync --frozen --no-dev

COPY --from=frontend-build /app/frontend/dist ./static

ENV LNOVEL_STATIC_DIR=/app/static
ENV LNOVEL_DATA_DIR=/app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
