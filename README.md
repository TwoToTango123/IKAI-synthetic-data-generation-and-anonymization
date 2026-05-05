# IKAI Synthetic Data Generation and Anonymization (MVP)

Проект предоставляет API для:
- генерации synthetic `users.csv`;
- анонимизации загруженного CSV (masking / pseudonymization / remove);
- обратного восстановления данных после pseudonymization по сохраненным в браузере карт;
- валидации JSON (users/orders) по JSON Schema.

**Безопасность:** Данные псевдонимов хранятся только в браузере пользователя. Сервер не имеет доступа к личным данным. Автоматическое удаление через 30 дней.

## Документация

| Документ | Описание |
|----------|---------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Развёртывание на Render, REG.RU, Docker — начните отсюда для production |
| [DOCKER.md](DOCKER.md) | Docker Compose и локальная разработка |
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | Безопасность, rate limiting, защита от DDoS |

## Stack

- Python
- FastAPI
- Faker
- jsonschema

## Project Structure

```text
app/
  __init__.py
  anonymization.py
  generation.py
  main.py
  pseudonym_store.py
  schema_validation.py
  logging_config.py
schemas/
  users.schema.json
  orders.schema.json
tests/
requirements.txt
docker/
  backend/
    Dockerfile
  frontend/
    Dockerfile
    nginx.conf
frontend/
  src/
    components/
    pages/
    services/
    App.jsx
    main.jsx
Procfile
DEPLOYMENT.md
DOCKER.md
SECURITY_AND_PRIVACY.md
```

## Setup

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
uvicorn app.main:app --reload
```

After startup:
- `http://127.0.0.1:8000/docs` - Swagger UI
- `http://127.0.0.1:8000/health` - health check

## Безопасность и лимиты

- **Размер файла**: максимум 50 МБ
- **Строк в CSV**: максимум 1,000,000
- **Rate limiting**: 20 запросов/минуту для `/generate`, 30 запросов/минуту для `/anonymize`, `/deanonymize`, `/csv-headers`, `/validate-json`
- **Хранение данных**: только в браузере пользователя, автоудаление через 30 дней
- **DDoS защита**: встроенное ограничение частоты запросов

Для подробной информации см. [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md)

## API

### 1. Generate CSV

`GET /generate?template=users&rows=100&phone_first_digits=9&email_domains=yandex.ru,gmail.com`

Parameters:
- `rows` - number of rows (1..100000)
- `template` - currently only `users`
- `phone_first_digits` - comma-separated first digit after +7
- `email_domains` - comma-separated allowed email domains

### 2. Anonymize CSV

`POST /anonymize`

Form-data:
- `file` - CSV file
- `method` - `masking` | `pseudonymization` | `remove`
- `target_columns` - columns for pseudonymization/remove
- `pseudonym_salt` - optional salt for pseudonymization
- `remove_mode` - `empty` or `drop` for remove mode
- `email_columns`, `phone_columns`, `name_columns`, `city_columns`, `digits_columns`, `date_columns`, `numeric_columns` - masking columns by type

For `method=pseudonymization`, response returns JSON with `csv` and `mapping`.
Save the returned `mapping` object: it is required to restore original values.

### 3. De-anonymize CSV (reverse pseudonymization)

`POST /deanonymize`

Form-data:
- `file` - pseudonymized CSV
- `mapping` - JSON string with the pseudonym mapping returned by `/anonymize`

If `mapping` is valid and matches the pseudonymized file, API returns restored CSV with original values.

Validation rules include:
- file name presence;
- `.csv` extension;
- non-empty payload;
- UTF-8 decoding;
- at least one target column;
- unknown columns check.

### 4. Validate JSON By Schema

`POST /validate-json?template=users`

`template` values:
- `users`
- `orders`

Request body:
- one JSON object; or
- array of JSON objects.

Response:
- `valid` - overall validation result
- `template`
- `items_checked`
- `errors` - detailed validation errors with index/path/message

## Schemas

- `schemas/users.schema.json` contains fields:
  - `full_name`, `email`, `phone`, `city`, `registered_at`
- `schemas/orders.schema.json` contains fields:
  - `order_id`, `user_id`, `date`, `amount`, `status`

## Tests

```powershell
python -m unittest discover -s tests -v
```

## CI/CD

GitHub Actions pipeline находится в [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) и выполняет:
- тесты backend;
- сборку frontend;
- сборку Docker-образов backend/frontend;
- авто-деплой при push в `main`.

Для deploy через Render добавьте GitHub Secrets:
- `RENDER_BACKEND_DEPLOY_HOOK_URL` — обязателен;
- `RENDER_FRONTEND_DEPLOY_HOOK_URL` — опционален, если frontend тоже деплоится через Render.

Pipeline запускается на `pull_request`, `push` в `main` и вручную через `workflow_dispatch`.

## Logs

- По умолчанию сервис пишет логи в stdout/stderr (чтобы их можно было смотреть через `docker logs` или через провайдера, например Render).
- В контейнере также создаётся файл логов по пути, указанному в переменной окружения `LOG_FILE` (по умолчанию `/var/log/ikai/ikai_app.log`).
- Если вы запускаете контейнер локально, просмотреть логи можно так:

```bash
docker logs <container-id>
tail -n 200 /var/log/ikai/ikai_app.log
```

На Render и подобных платформах читайте stdout/stderr через веб-интерфейс сервиса.
