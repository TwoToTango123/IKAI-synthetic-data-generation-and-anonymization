# IKAI Synthetic Data Generation and Anonymization (MVP)

Проект предоставляет API для:
- генерации synthetic `users.csv`;
- анонимизации загруженного CSV (email, phone, name);
- валидации JSON (users/orders) по JSON Schema.

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
  schema_validation.py
schemas/
  users.schema.json
  orders.schema.json
static/
tests/
requirements.txt
README.md
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
- `email_columns` - columns for email masking
- `phone_columns` - columns for phone masking
- `name_columns` - columns for name masking

Validation rules include:
- file name presence;
- `.csv` extension;
- non-empty payload;
- UTF-8 decoding;
- at least one target column;
- unknown columns check.

### 3. Validate JSON By Schema

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
