# 🐳 Docker

Проект состоит из двух сервисов:

- **backend** — FastAPI (генерация, анонимизация, валидация)
- **frontend** — Vite + Nginx (UI + прокси `/api → backend`)

---

## ⚠️ Изменения безопасности

✅ **Текущая версия:**
- Карты псевдонимов хранятся **только в браузере** (localStorage)
- Сервер **не хранит** личные данные пользователей
- Автоматическое удаление через **30 дней**
- **Встроенный rate limiting** для защиты от DDoS
- **Ограничение размеров файлов** — максимум 50 МБ

Для деталей см. [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md)

---

## 📦 Быстрый старт с Docker Compose

```bash
docker-compose up --build
```

Откройте:
- **Frontend**: http://localhost:3000
- **Backend Swagger**: http://localhost:8000/docs

---

## 🚀 Что поднимается

### Backend
- Контейнер: `ikai-backend`
- Порт: `8000`
- URL: http://localhost:8000
- Swagger: http://localhost:8000/docs

**Ограничения:**
- Размер файла: 50 МБ
- Строк в CSV: 1,000,000
- Rate limits (на IP-адрес):
  - `/generate`: 20 запросов/минуту
  - `/anonymize`: 30 запросов/минуту
  - `/deanonymize`: 30 запросов/минуту
  - `/csv-headers`: 30 запросов/минуту
  - `/validate-json`: 30 запросов/минуту

### Frontend
- Контейнер: `ikai-frontend`
- Порт: `3000`
- URL: http://localhost:3000
- API проксируется через `/api` → `http://localhost:8000`

---

## 📊 Архитектура

```
Browser → Frontend (Nginx :80)
              ↓ /api
          Backend (FastAPI :8000)
```

---

## 🔍 Логирование

Логи выводятся в stdout/stderr контейнера:

```bash
# Backend логи
docker logs -f ikai-backend

# Frontend логи
docker logs -f ikai-frontend
```

В контейнере backend также создаётся файл логов:
- **Путь**: `/var/log/ikai/ikai_app.log`
- **Ротация**: 10 МБ на файл, 5 backups

---

## 🌐 Deployment

Для развёртывания на production (Render, AWS, GCP и т.д.):

👉 **[DEPLOYMENT.md](DEPLOYMENT.md)** — Полное руководство по развёртыванию на Render, REG.RU и других платформах.

---

## 📝 API Endpoints

### Генерация CSV

```bash
GET /generate?template=users&rows=100

# Параметры:
# - template: users | orders
# - rows: 1-100000
# - phone_first_digits: 9 (по умолчанию)
# - email_domains: yandex.ru,gmail.com (по умолчанию)
```

### Анонимизация

```bash
POST /anonymize
Form:
  - file: CSV файл
  - method: masking | pseudonymization | remove
  - target_columns: email,name (для pseudonymization/remove)
  - pseudonym_salt: опционально
  - email_columns, phone_columns, etc: для masking

Response (для pseudonymization):
  {
    "csv": "...",
    "mapping": { "columns": { ... } }
  }
```

### Восстановление данных

```bash
POST /deanonymize
Form:
  - file: CSV файл (pseudonymized)
  - mapping: JSON строка (из /anonymize ответа)

Response: Восстановленный CSV
```

### Валидация JSON

```bash
POST /validate-json?template=users
Body: { ... } или [ { ... }, { ... } ]

Response:
  {
    "valid": true,
    "template": "users",
    "items_checked": 5,
    "errors": []
  }
```

### Health Check

```bash
GET /health

Response: { "status": "ok" }
```

---

## 🧪 Локальная разработка (без Docker)

### Backend

```bash
# 1. Активируйте venv
.\.venv\Scripts\Activate.ps1  # Windows PowerShell
# или
source .venv/bin/activate  # macOS/Linux

# 2. Установите зависимости
pip install -r requirements.txt

# 3. Запустите сервер
uvicorn app.main:app --reload
```

Backend: http://localhost:8000

### Frontend

```bash
cd frontend

# Установите зависимости
npm install

# Запустите dev сервер
npm run dev
```

Frontend: http://localhost:5173

---

## 🐛 Troubleshooting

**Port уже используется:**
```bash
# Измените порт в docker-compose.yml
ports:
  - "8001:8000"  # используйте 8001 вместо 8000
```

**Контейнер не стартует:**
```bash
docker logs ikai-backend  # смотрите ошибки
docker-compose down
docker-compose up --build  # пересоберите
```

**CORS ошибки при запросе с frontend:**
- Проверьте `ALLOW_ORIGINS` переменную (см. [DEPLOYMENT.md](DEPLOYMENT.md))
- Убедитесь, что домен точно совпадает (https:// vs http://)

---

## 📄 Дополнительно

- [README.md](README.md) — Документация API и использование
- [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) — Безопасность
- [DEPLOYMENT.md](DEPLOYMENT.md) — Развёртывание на production