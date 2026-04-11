from __future__ import annotations

from datetime import date
from typing import Any
from typing import Annotated

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, Response

from app.anonymization import anonymize_csv_email_mask
from app.anonymization import extract_csv_headers
from app.generation import ALLOWED_EMAIL_DOMAINS, generate_users_csv, generate_orders_csv, generated_filename
from app.schema_validation import validate_payload

app = FastAPI(title="Synthetic CSV Generator")


def _decode_csv_bytes(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Файл должен быть в UTF-8 или Windows-1251 (CP1251)")


@app.get("/")
def index() -> FileResponse:
    return FileResponse("static/index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/generate", response_class=PlainTextResponse)
def generate(
    rows: Annotated[int, Query(ge=1, le=10000)] = 100,
    template: Annotated[str, Query()] = "users",
    country_codes: Annotated[str, Query()] = "7",
    phone_prefix: Annotated[str, Query()] = "",
    email_domains: Annotated[str, Query()] = "yandex.ru,mail.ru,rambler.ru,gmail.com,microsoft.com",
    registered_from: Annotated[str, Query()] = "",
    registered_to: Annotated[str, Query()] = "",
    order_date_from: Annotated[str, Query()] = "",
    order_date_to: Annotated[str, Query()] = "",
    amount_min: Annotated[str, Query()] = "",
    amount_max: Annotated[str, Query()] = "",
    statuses: Annotated[str, Query()] = "new,paid,processing,completed,cancelled",
) -> Response:
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


@app.post("/anonymize")
async def anonymize(
    file: Annotated[UploadFile, File(...)],
    method: Annotated[str, Form()] = "masking",
    target_columns: Annotated[str, Form()] = "",
    remove_mode: Annotated[str, Form()] = "empty",
    pseudonym_salt: Annotated[str, Form()] = "",
    email_columns: Annotated[str, Form()] = "",
    phone_columns: Annotated[str, Form()] = "",
    name_columns: Annotated[str, Form()] = "",
    city_columns: Annotated[str, Form()] = "",
    digits_columns: Annotated[str, Form()] = "",
    date_columns: Annotated[str, Form()] = "",
    numeric_columns: Annotated[str, Form()] = "",
) -> Response:
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
        elif method == "pseudonymization":
            content = anonymize_csv_with_pseudonyms(
                text,
                target_columns=target_cols,
                salt=pseudonym_salt,
            )
        else:
            content = anonymize_csv_with_removal(
                text,
                target_columns=target_cols,
                mode=remove_mode,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    filename = f"anonymized_{file.filename}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@app.post("/validate-json")
def validate_json(
    template: Annotated[str, Query(pattern="^(users|orders)$")],
    payload: Annotated[Any, Body(...)],
) -> dict[str, Any]:
    try:
        return validate_payload(template, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/csv-headers")
async def csv_headers(file: Annotated[UploadFile, File(...)]) -> dict[str, list[str]]:
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
