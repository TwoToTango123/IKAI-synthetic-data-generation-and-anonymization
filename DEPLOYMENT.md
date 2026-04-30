# 🚀 Deployment Guide

Данное руководство описывает развёртывание приложения на различных платформах.

## Оглавление
- [Render (PaaS) — Рекомендуется](#render-paas--рекомендуется)
- [Docker Compose (Локально/VPS)](#docker-compose-локальноvps)
- [REG.RU Shared Hosting + Render Backend](#regru-shared-hosting--render-backend)
- [Environment Variables](#environment-variables)

---

## Render (PaaS) — Рекомендуется

**Преимущества:**
- ✅ Бесплатный tier для разработки/демо
- ✅ Автоматический deploy из GitHub
- ✅ Auto-scaling по нагрузке
- ✅ Встроенный мониторинг логов
- ✅ HTTPS по умолчанию

### Шаг 1: Подготовка кода

Убедитесь, что файлы готовы:
- ✅ `Procfile` (инструкция запуска для Render)
- ✅ `requirements.txt` (зависимости Python)
- ✅ `app/` папка с кодом
- ✅ `schemas/` папка с JSON schemas

Закомитьте в GitHub:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Шаг 2: Создание Web Service на Render

1. Переходите на https://dashboard.render.com
2. Нажмите **New** → **Web Service**
3. **Connect repository** → выберите свой репозиторий
4. Заполните параметры:

| Параметр | Значение |
|----------|----------|
| **Name** | `ikai-backend` (или другое) |
| **Environment** | `Python 3` |
| **Region** | Выберите ближайший (например, `Frankfurt`) |
| **Branch** | `main` |
| **Build Command** | `pip install --upgrade pip setuptools wheel && pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level info` |
| **Instance Type** | `Free` |

5. Нажмите **Create Web Service** и ждите deploy (~3-5 минут)

### Шаг 3: Настройка Environment Variables

На странице сервиса перейдите в **Environment**:

| Переменная | Значение | Описание |
|-----------|----------|----------|
| `ALLOW_ORIGINS` | `https://datagentool.ru,https://www.datagentool.ru` | CORS список доменов |
| `LOG_FILE` | `/tmp/ikai_app.log` | Путь логов (опционально) |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Окно rate-limitinga (сек) |
| `RATE_LIMIT_GENERATE_PER_WINDOW` | `20` | Лимит для /generate |
| `RATE_LIMIT_ANONYMIZE_PER_WINDOW` | `30` | Лимит для /anonymize |
| `RATE_LIMIT_DEANONYMIZE_PER_WINDOW` | `30` | Лимит для /deanonymize |
| `RATE_LIMIT_CSV_HEADERS_PER_WINDOW` | `30` | Лимит для /csv-headers |
| `RATE_LIMIT_VALIDATE_JSON_PER_WINDOW` | `30` | Лимит для /validate-json |

После изменения переменных сервис автоматически перезагрузится.

### Шаг 4: Получение URL Backend'а

После deploy на странице сервиса будет URL вроде:
```
https://ikai-backend-xxxxx.onrender.com
```

Это и есть ваш backend API. Сохраните его.

### Шаг 5: Проверка Health Endpoint

```bash
curl https://ikai-backend-xxxxx.onrender.com/health
# Должен вернуть: {"status":"ok"}
```

### Шаг 6: Просмотр логов

На Render перейдите в **Logs** → смотрите stdout/stderr:
- `[INFO] Uvicorn running on ...`
- `[INFO] Application startup complete`

---

## Docker Compose (Локально/VPS)

Для локальной разработки или VPS с Docker:

```bash
# 1. Соберите образы
docker-compose build

# 2. Запустите сервисы
docker-compose up

# 3. Откройте
#    - Frontend: http://localhost:3000
#    - Backend Swagger: http://localhost:8000/docs
```

Backend слушает на `http://localhost:8000`
Frontend автоматически проксирует `/api` → `http://localhost:8000`

### Logs в Docker

```bash
# Смотреть логи backend
docker logs -f ikai-backend

# Смотреть логи frontend
docker logs -f ikai-frontend
```

---

## REG.RU Shared Hosting + Render Backend

**Сценарий:** Frontend на REG.RU shared hosting, Backend на Render PaaS

### Для Backend (на Render)

Следуйте инструкции [Render (PaaS)](#render-paas--рекомендуется) выше.

### Для Frontend (на REG.RU)

1. **Обновите frontend API URL**

   Файл: `frontend/.env.production`
   ```
   VITE_API_URL=https://ikai-backend-xxxxx.onrender.com
   ```

2. **Соберите frontend**

   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. **Загрузите на REG.RU**

   ```bash
   # Архивируйте dist
   Compress-Archive -Path frontend\dist -DestinationPath frontend\dist.zip
   
   # Загрузьте по SCP
   scp frontend\dist.zip u3499029@server80.hosting.reg.ru:~/www/datagentool.ru/
   
   # На сервере распакуйте
   ssh u3499029@server80.hosting.reg.ru
   cd ~/www/datagentool.ru
   unzip dist.zip -d tempdist
   cp -r tempdist/* ./
   rm -rf tempdist dist.zip
   ```

4. **Проверьте HTTPS/SSL**

   На REG.RU автоматически настройте Let's Encrypt сертификат или используйте существующий.

### Проверка интеграции

1. Откройте `https://datagentool.ru` в браузере
2. Откройте DevTools → Network
3. Убедитесь, что запросы идут на `https://ikai-backend-xxxxx.onrender.com`
4. Проверьте CORS ошибок в Console

---

## Environment Variables

Полный список переменных:

```bash
# CORS
ALLOW_ORIGINS=https://datagentool.ru,https://www.datagentool.ru,http://localhost:3000

# Логирование
LOG_FILE=/tmp/ikai_app.log      # Путь к файлу логов (опционально)

# Rate Limiting
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_DEFAULT_PER_WINDOW=60
RATE_LIMIT_GENERATE_PER_WINDOW=20
RATE_LIMIT_ANONYMIZE_PER_WINDOW=30
RATE_LIMIT_DEANONYMIZE_PER_WINDOW=30
RATE_LIMIT_CSV_HEADERS_PER_WINDOW=30
RATE_LIMIT_VALIDATE_JSON_PER_WINDOW=30
```

---

## Мониторинг и поддержка

### Render Логи

```
Dashboard → Logs
```

Смотрите:
- Uvicorn startup сообщения
- API запросы и ошибки
- Критические ошибки

### Health Check

```bash
# Backend health
curl https://ikai-backend-xxxxx.onrender.com/health

# Swagger документация
curl https://ikai-backend-xxxxx.onrender.com/docs
```

### Проблемы

**Ошибка CORS при запросе с frontend:**
- Проверьте `ALLOW_ORIGINS` переменную в Render
- Убедитесь, что домен frontend точно совпадает (https:// prefix важен)
- Перезагрузитесь сервис: Dashboard → Manuals restart

**Backend slow to start:**
- Бесплатный tier может иметь холодный старт (~30сек)
- Платный tier стартует мгновенно

**Файлы логов не создаются:**
- На Render используйте stdout/stderr (видны в Dashboard → Logs)
- Переменная `LOG_FILE` опциональна; /tmp может не быть персистентным

---

## Production Checklist

- ✅ Backend развёрнут на Render
- ✅ Frontend собран с правильным `VITE_API_URL`
- ✅ SSL сертификат установлен (HTTPS)
- ✅ ALLOW_ORIGINS включает все используемые домены
- ✅ Rate limiting включен
- ✅ Логи видны и мониторятся
- ✅ Health endpoint отвечает 200
- ✅ CORS ошибок нет в браузере Console
