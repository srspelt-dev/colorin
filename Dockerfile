FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-builder /frontend/dist ./frontend_dist

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 9137

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-9137}"]

