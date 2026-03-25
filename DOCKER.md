# Docker Documentation

В проекте есть два отдельных Dockerfile:

- `docker/backend/Dockerfile` для backend на FastAPI
- `docker/frontend/Dockerfile` для frontend на React/Vite

Также для frontend добавлен:

- `docker/frontend/nginx.conf` для раздачи собранного frontend

## Backend Dockerfile

Файл: `docker/backend/Dockerfile`

Что делает:

-  образ `python:3.11-slim`
- копирует `requirements.txt`
- устанавливает Python-зависимости
- копирует папки `app/` и `schemas/`
- запускает приложение через `uvicorn`

Сборка образа:

```bash
docker build -f docker/backend/Dockerfile -t ikai-backend .
```

Запуск контейнера:

```bash
docker run --rm -p 8000:8000 ikai-backend
```

После запуска backend будет доступен по адресу:

```text
http://localhost:8000
```

## Frontend Dockerfile

Файл: `docker/frontend/Dockerfile`

Что делает:

- использует `node:20-alpine` для сборки frontend
- копирует файлы из папки `frontend/`
- выполняет `npm ci`
- выполняет `npm run build`
- переносит собранный `dist` в образ `nginx`
- запускает Nginx на порту `80`

Сборка образа:

```bash
docker build -f docker/frontend/Dockerfile -t ikai-frontend .
```

Если нужно передать адрес API на этапе сборки:

```bash
docker build \
  -f docker/frontend/Dockerfile \
  -t ikai-frontend \
  --build-arg VITE_API_URL=http://localhost:8000/api \
  .
```

Запуск контейнера:

```bash
docker run --rm -p 3000:80 ikai-frontend
```

После запуска frontend будет доступен по адресу:

```text
http://localhost:3000
```

## Nginx конфиг для frontend

Файл: `docker/frontend/nginx.conf`

Что делает:

- раздает статические frontend-файлы
- поддерживает SPA-маршрутизацию через `try_files`
- проксирует запросы `/api/` на backend

Сейчас в конфиге backend указан как:

```text
http://backend:8000
```

