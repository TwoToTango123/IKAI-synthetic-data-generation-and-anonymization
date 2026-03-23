from __future__ import annotations

from typing import Any
from typing import Annotated

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, Response

from app.anonymization import anonymize_csv_email_mask
from app.generation import generate_users_csv, generated_filename
from app.schema_validation import validate_payload

app = FastAPI(title="Synthetic CSV Generator")


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
    phone_first_digits: Annotated[str, Query()] = "9",
    email_domains: Annotated[str, Query()] = "yandex.ru,mail.ru,rambler.ru,gmail.com,microsoft.com",
) -> Response:
    if template != "users":
        raise HTTPException(status_code=400, detail="Поддерживается только шаблон users")

    phone_digits_list = [d.strip() for d in phone_first_digits.split(",") if d.strip()]
    if not phone_digits_list:
        raise HTTPException(status_code=400, detail="Нужна хотя бы одна первая цифра для телефона")
    for digit in phone_digits_list:
        if digit not in "0123456789":
            raise HTTPException(status_code=400, detail=f"Первая цифра должна быть 0-9, получено: {digit}")
    
    email_domains_list = [d.strip() for d in email_domains.split(",") if d.strip()]
    if not email_domains_list:
        raise HTTPException(status_code=400, detail="Нужен хотя бы один домен для email")

    content = generate_users_csv(rows, phone_first_digits=phone_digits_list, email_domains=email_domains_list)
    filename = generated_filename("users")
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@app.post("/anonymize")
async def anonymize(
    file: Annotated[UploadFile, File(...)],
    email_columns: Annotated[str, Form()] = "",
    phone_columns: Annotated[str, Form()] = "",
    name_columns: Annotated[str, Form()] = "",
) -> Response:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Не передано имя файла")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Нужен CSV-файл")

    raw = await file.read()
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Файл пустой")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Файл должен быть в UTF-8") from exc

    # Parse column lists
    email_cols = [c.strip() for c in email_columns.split(",") if c.strip()]
    phone_cols = [c.strip() for c in phone_columns.split(",") if c.strip()]
    name_cols = [c.strip() for c in name_columns.split(",") if c.strip()]

    try:
        from app.anonymization import anonymize_csv_with_masks
        content = anonymize_csv_with_masks(
            text,
            email_columns=email_cols,
            phone_columns=phone_cols,
            name_columns=name_cols,
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
