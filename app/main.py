from __future__ import annotations

import json
import os
from datetime import date
from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from typing import Any

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, UploadFile, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from app.logging_config import configure_logging
import logging

# Configure logging as early as possible
configure_logging()
logger = logging.getLogger(__name__)

from app.anonymization import anonymize_csv_email_mask
from app.anonymization import deanonymize_csv_with_pseudonyms
from app.anonymization import extract_csv_headers
from app.generation import ALLOWED_EMAIL_DOMAINS, generate_users_csv, generate_orders_csv, generated_filename
from app.pseudonym_store import extract_mapping_for_deanonymize
from app.schema_validation import validate_payload

app = FastAPI(title="Synthetic CSV Generator")

# CORS configuration - allow requests from frontend domains
# Allow configuring allowed origins from environment for deployments (comma-separated)
allow_origins_env = os.getenv("ALLOW_ORIGINS", "")
if allow_origins_env:
    allow_origins = [s.strip() for s in allow_origins_env.split(",") if s.strip()]
else:
    allow_origins = [
        "https://datagentool.ru",
        "https://www.datagentool.ru",
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Security configuration
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_CSV_ROWS = int(os.getenv("MAX_CSV_ROWS", "1000000"))
MAX_CONCURRENT_PROCESSING = 100  # Защита от DDoS

RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_DEFAULT_PER_WINDOW = int(os.getenv("RATE_LIMIT_DEFAULT_PER_WINDOW", "60"))
RATE_LIMITS_PER_WINDOW: dict[tuple[str, str], int] = {
    ("GET", "/generate"): int(os.getenv("RATE_LIMIT_GENERATE_PER_WINDOW", "20")),
    ("POST", "/anonymize"): int(os.getenv("RATE_LIMIT_ANONYMIZE_PER_WINDOW", "30")),
    ("POST", "/deanonymize"): int(os.getenv("RATE_LIMIT_DEANONYMIZE_PER_WINDOW", "30")),
    ("POST", "/csv-headers"): int(os.getenv("RATE_LIMIT_CSV_HEADERS_PER_WINDOW", "30")),
    ("POST", "/validate-json"): int(os.getenv("RATE_LIMIT_VALIDATE_JSON_PER_WINDOW", "30")),
}


class InMemoryRateLimiter:
    def __init__(self, window_seconds: int, limits: dict[tuple[str, str], int], default_limit: int) -> None:
        self.window_seconds = window_seconds
        self.limits = limits
        self.default_limit = default_limit
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _client_identifier(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "").strip()
        if forwarded_for:
            return forwarded_for.split(",")[0].strip() or "unknown"

        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip

        if request.client and request.client.host:
            return request.client.host

        return "unknown"

    def _limit_for(self, request: Request) -> int | None:
        path = request.url.path
        if path in {"/", "/health", "/docs", "/redoc", "/openapi.json"}:
            return None

        if request.method == "OPTIONS":
            return None

        return self.limits.get((request.method, path), self.default_limit)

    def check(self, request: Request) -> JSONResponse | None:
        limit = self._limit_for(request)
        if limit is None:
            return None

        now = monotonic()
        bucket_key = f"{self._client_identifier(request)}:{request.method}:{request.url.path}"

        with self._lock:
            bucket = self._requests[bucket_key]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Слишком много запросов. Попробуйте позже.",
                        "limit": limit,
                        "window_seconds": self.window_seconds,
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                    },
                )

            bucket.append(now)
            remaining = max(0, limit - len(bucket))
            request.state.rate_limit_limit = limit
            request.state.rate_limit_remaining = remaining

        return None


rate_limiter = InMemoryRateLimiter(
    window_seconds=RATE_LIMIT_WINDOW_SECONDS,
    limits=RATE_LIMITS_PER_WINDOW,
    default_limit=RATE_LIMIT_DEFAULT_PER_WINDOW,
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    limited_response = rate_limiter.check(request)
    if limited_response is not None:
        return limited_response

    response = await call_next(request)
    limit = getattr(request.state, "rate_limit_limit", None)
    remaining = getattr(request.state, "rate_limit_remaining", None)
    if limit is not None:
        response.headers.setdefault("X-RateLimit-Limit", str(limit))
    if remaining is not None:
        response.headers.setdefault("X-RateLimit-Remaining", str(remaining))
    return response


def _decode_csv_bytes(raw: bytes) -> str:
    """Decode CSV bytes with size validation."""
    if len(raw) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"Файл слишком большой. Максимум: {MAX_FILE_SIZE_MB} МБ")
    
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Файл должен быть в UTF-8 или Windows-1251 (CP1251)")


@app.get("/")
def index() -> dict[str, str]:
    return {
        "message": "IKAI Synthetic Data API is running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/generate", response_class=PlainTextResponse)
async def generate(
    request: Request,
    rows: int = Query(100, ge=1, le=100000),
    template: str = Query("users"),
    country_codes: str = Query("7"),
    phone_prefix: str = Query(""),
    email_domains: str = Query("yandex.ru,mail.ru,rambler.ru,gmail.com,microsoft.com"),
    registered_from: str = Query(""),
    registered_to: str = Query(""),
    order_date_from: str = Query(""),
    order_date_to: str = Query(""),
    amount_min: str = Query(""),
    amount_max: str = Query(""),
    statuses: str = Query("new,paid,processing,completed,cancelled"),
):
    if template not in ("users", "orders"):
        raise HTTPException(status_code=400, detail="Шаблон должен быть users или orders")

    if template == "orders":
        allowed_statuses = {"new", "paid", "processing", "completed", "cancelled"}
        statuses_list = [s.strip() for s in statuses.split(",") if s.strip()]
        if not statuses_list:
            raise HTTPException(status_code=400, detail="Выберите хотя бы один статус")
        unknown_statuses = [s for s in statuses_list if s not in allowed_statuses]
        if unknown_statuses:
            raise HTTPException(status_code=400, detail=f"Недопустимые статусы: {', '.join(unknown_statuses)}")

        order_date_from_value: date | None = None
        if order_date_from.strip():
            try:
                order_date_from_value = date.fromisoformat(order_date_from.strip())
            except ValueError as exc:
                raise HTTPException(status_code=400, detail='Дата заказа "с" должна быть в формате YYYY-MM-DD') from exc

        order_date_to_value: date | None = None
        if order_date_to.strip():
            try:
                order_date_to_value = date.fromisoformat(order_date_to.strip())
            except ValueError as exc:
                raise HTTPException(status_code=400, detail='Дата заказа "по" должна быть в формате YYYY-MM-DD') from exc

        if order_date_to_value and order_date_to_value > date.today():
            raise HTTPException(status_code=400, detail='Дата заказа "по" не может быть в будущем')
        if order_date_from_value and order_date_from_value > date.today():
            raise HTTPException(status_code=400, detail='Дата заказа "с" не может быть в будущем')
        if order_date_from_value and order_date_to_value and order_date_from_value > order_date_to_value:
            raise HTTPException(status_code=400, detail='Дата заказа "с" не может быть больше даты "по"')

        amount_min_value: float | None = None
        if amount_min.strip():
            try:
                amount_min_value = float(amount_min.strip())
            except ValueError as exc:
                raise HTTPException(status_code=400, detail='Минимальная сумма должна быть числом') from exc

        amount_max_value: float | None = None
        if amount_max.strip():
            try:
                amount_max_value = float(amount_max.strip())
            except ValueError as exc:
                raise HTTPException(status_code=400, detail='Максимальная сумма должна быть числом') from exc

        if amount_min_value is not None and amount_min_value < 0:
            raise HTTPException(status_code=400, detail='Минимальная сумма не может быть отрицательной')
        if amount_max_value is not None and amount_max_value <= 0:
            raise HTTPException(status_code=400, detail='Максимальная сумма должна быть больше 0')
        if amount_min_value is not None and amount_max_value is not None and amount_min_value > amount_max_value:
            raise HTTPException(status_code=400, detail='Минимальная сумма не может быть больше максимальной')

        content = generate_orders_csv(
            rows,
            order_date_from=order_date_from_value,
            order_date_to=order_date_to_value,
            amount_min=amount_min_value,
            amount_max=amount_max_value,
            statuses=statuses_list,
        )
        filename = generated_filename("orders")
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)

    # Генерация шаблона users
    country_codes_list = [c.strip() for c in country_codes.split(",") if c.strip()]
    if not country_codes_list:
        raise HTTPException(status_code=400, detail="Нужен хотя бы один код страны")
    for code in country_codes_list:
        if not code.isdigit() or not (1 <= len(code) <= 3):
            raise HTTPException(status_code=400, detail=f"Код страны должен состоять из 1-3 цифр: {code}")
        if code.startswith("0"):
            raise HTTPException(status_code=400, detail=f"Код страны не может начинаться с 0: {code}")

    phone_prefix = phone_prefix.strip()
    if phone_prefix:
        if not phone_prefix.isdigit():
            raise HTTPException(status_code=400, detail="Префикс телефона должен состоять только из цифр")
        if not (1 <= len(phone_prefix) <= 3):
            raise HTTPException(status_code=400, detail="Префикс телефона должен содержать от 1 до 3 цифр")
    
    email_domains_list = [d.strip() for d in email_domains.split(",") if d.strip()]
    if not email_domains_list:
        raise HTTPException(status_code=400, detail="Нужен хотя бы один домен для email")
    unsupported_domains = [d for d in email_domains_list if d not in ALLOWED_EMAIL_DOMAINS]
    if unsupported_domains:
        allowed = ", ".join(ALLOWED_EMAIL_DOMAINS)
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимые домены: {', '.join(unsupported_domains)}. Разрешены: {allowed}",
        )

    registered_from_date: date | None = None
    if registered_from.strip():
        try:
            registered_from_date = date.fromisoformat(registered_from.strip())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail='Дата "с" должна быть в формате YYYY-MM-DD') from exc

    registered_to_date: date | None = None
    if registered_to.strip():
        try:
            registered_to_date = date.fromisoformat(registered_to.strip())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail='Дата "по" должна быть в формате YYYY-MM-DD') from exc

    if registered_to_date and registered_to_date > date.today():
        raise HTTPException(status_code=400, detail='Дата "по" не может быть в будущем')
    if registered_from_date and registered_from_date > date.today():
        raise HTTPException(status_code=400, detail='Дата "с" не может быть в будущем')
    if registered_from_date and registered_to_date and registered_from_date > registered_to_date:
        raise HTTPException(status_code=400, detail='Дата "с" не может быть больше даты "по"')

    content = generate_users_csv(
        rows,
        country_codes=country_codes_list,
        phone_prefix=phone_prefix or None,
        email_domains=email_domains_list,
        registered_from=registered_from_date,
        registered_to=registered_to_date,
    )
    filename = generated_filename("users")
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@app.post("/anonymize", response_model=None)
async def anonymize(
    request: Request,
    file: UploadFile = File(...),
    method: str = Form("masking"),
    target_columns: str = Form(""),
    remove_mode: str = Form("empty"),
    pseudonym_salt: str = Form(""),
    email_columns: str = Form(""),
    phone_columns: str = Form(""),
    name_columns: str = Form(""),
    city_columns: str = Form(""),
    digits_columns: str = Form(""),
    date_columns: str = Form(""),
    numeric_columns: str = Form(""),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Не передано имя файла")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Нужен CSV-файл")

    raw = await file.read()
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Файл пустой")

    try:
        text = _decode_csv_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Parse column lists
    email_cols = [c.strip() for c in email_columns.split(",") if c.strip()]
    phone_cols = [c.strip() for c in phone_columns.split(",") if c.strip()]
    name_cols = [c.strip() for c in name_columns.split(",") if c.strip()]
    city_cols = [c.strip() for c in city_columns.split(",") if c.strip()]
    digits_cols = [c.strip() for c in digits_columns.split(",") if c.strip()]
    date_cols = [c.strip() for c in date_columns.split(",") if c.strip()]
    numeric_cols = [c.strip() for c in numeric_columns.split(",") if c.strip()]
    target_cols = [c.strip() for c in target_columns.split(",") if c.strip()]

    allowed_methods = {"masking", "pseudonymization", "remove"}
    if method not in allowed_methods:
        raise HTTPException(status_code=400, detail="Метод должен быть masking, pseudonymization или remove")

    try:
        from app.anonymization import anonymize_csv_with_masks
        from app.anonymization import anonymize_csv_with_pseudonyms
        from app.anonymization import anonymize_csv_with_removal

        if method == "masking":
            content = anonymize_csv_with_masks(
                text,
                email_columns=email_cols,
                phone_columns=phone_cols,
                name_columns=name_cols,
                city_columns=city_cols,
                digits_columns=digits_cols,
                date_columns=date_cols,
                numeric_columns=numeric_cols,
            )
            filename = f"anonymized_{file.filename}"
            headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
            return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)
            
        elif method == "pseudonymization":
            content, mapping = anonymize_csv_with_pseudonyms(
                text,
                target_columns=target_cols,
                salt=pseudonym_salt,
            )
            # Return mapping embedded in response for client-side storage
            filename = f"anonymized_{file.filename}"
            response_data = {
                "csv": content,
                "mapping": mapping,
            }
            headers = {
                "Content-Disposition": f'attachment; filename="{filename}.json"'
            }
            return Response(
                content=json.dumps(response_data, ensure_ascii=False),
                media_type="application/json",
                headers=headers
            )
        else:
            content = anonymize_csv_with_removal(
                text,
                target_columns=target_cols,
                mode=remove_mode,
            )
            filename = f"anonymized_{file.filename}"
            headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
            return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/deanonymize", response_model=None)
async def deanonymize(
    request: Request,
    file: UploadFile = File(...),
    mapping: str = Form(...),
):
    """
    Restore original values from pseudonyms using mapping provided by client.
    
    Args:
        file: CSV file with pseudonymized data
        mapping: JSON string with mapping (from client-side storage)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Не передано имя файла")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Нужен CSV-файл")

    raw = await file.read()
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Файл пустой")

    try:
        text = _decode_csv_bytes(raw)
        # Parse mapping JSON from client
        try:
            mapping_data = json.loads(mapping)
        except json.JSONDecodeError as exc:
            raise ValueError("Некорректный формат mapping JSON") from exc

        normalized_mapping = extract_mapping_for_deanonymize(mapping_data)
        content = deanonymize_csv_with_pseudonyms(text, normalized_mapping, strict=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    filename = f"restored_{file.filename}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@app.post("/validate-json", response_model=None)
async def validate_json(
    request: Request,
    template: str = Query(..., pattern="^(users|orders)$"),
    payload: Any = Body(...),
) -> dict[str, Any]:
    try:
        return validate_payload(template, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/csv-headers", response_model=None)
async def csv_headers(
    request: Request,
    file: UploadFile = File(...),
) -> dict[str, list[str]]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Не передано имя файла")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Нужен CSV-файл")

    raw = await file.read()
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Файл пустой")

    try:
        text = _decode_csv_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        headers = extract_csv_headers(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"headers": headers}
