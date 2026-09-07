FROM node:22-bookworm-slim AS frontend
WORKDIR /app/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/index.html apps/web/tsconfig.json apps/web/vite.config.ts ./
COPY apps/web/src/ src/
COPY themes/ /app/themes/
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.6.6 AS uv
FROM python:3.12-slim-bookworm
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock README.md LICENSE ./
COPY library/ library/
COPY packages/ packages/
COPY apps/__init__.py apps/__init__.py
COPY apps/api/ apps/api/
RUN uv sync --frozen --extra hosting --no-dev --no-editable
COPY --from=frontend /app/apps/web/dist/ apps/web/dist/
RUN useradd --uid 10001 --create-home machina
USER machina
ENV PATH="/app/.venv/bin:$PATH" MACHINA_HOST=0.0.0.0 MACHINA_DEPLOYMENT=hosted
CMD ["python", "-m", "apps.api.main"]
