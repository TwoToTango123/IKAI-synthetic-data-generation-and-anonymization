# Docker

Проект состоит из двух сервисов:

- **backend** — FastAPI (генерация, анонимизация, валидация)
- **frontend** — Vite + Nginx (UI + прокси `/api → backend`)

---

## Быстрый старт

    docker compose up --build

---

## Что поднимается

### Backend
- контейнер: `ikai-backend`
- порт: `8000`
- URL: http://localhost:8000
- Swagger: http://localhost:8000/docs

### Frontend
- контейнер: `ikai-frontend`
- порт: `3000`
- URL: http://localhost:3000
- API проксируется через `/api`

---

## Архитектура

    browser → frontend (nginx :80)
                 ↓ /api
             backend (fastapi :8000)

---

## Основные endpoints

### Генерация CSV

GET /generate

#### users

    curl "http://localhost:8000/generate?template=users&rows=100"

#### orders

    curl "http://localhost:8000/generate?template=orders&rows=100"

---

### Анонимизация

POST /anonymize

#### masking

    curl -X POST http://localhost:8000/anonymize \
      -F "file=@data.csv" \
      -F "method=masking" \
      -F "email_columns=email" \
      -F "phone_columns=phone"

#### pseudonymization

    curl -X POST http://localhost:8000/anonymize \
      -F "file=@data.csv" \
      -F "method=pseudonymization" \
      -F "target_columns=email,phone" \
      -F "pseudonym_salt=secret"

#### remove

    curl -X POST http://localhost:8000/anonymize \
      -F "file=@data.csv" \
      -F "method=remove" \
      -F "target_columns=email" \
      -F "remove_mode=drop"

---

### Заголовки CSV

    curl -X POST http://localhost:8000/csv-headers \
      -F "file=@data.csv"

---

### Валидация JSON

    curl -X POST "http://localhost:8000/validate-json?template=users" \
      -H "Content-Type: application/json" \
      -d '{"full_name":"Test","email":"test@test.com","phone":"+79991234567","city":"Moscow","registered_at":"2024-01-01"}'

---

## Отдельный запуск сервисов

### Backend

    docker build -f docker/backend/Dockerfile -t ikai-backend .
    docker run -p 8000:8000 ikai-backend

### Frontend

    docker build -f docker/frontend/Dockerfile -t ikai-frontend .
    docker run -p 3000:80 ikai-frontend

---

## Пересборка

    docker compose down
    docker compose up --build