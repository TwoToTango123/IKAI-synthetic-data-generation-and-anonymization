from __future__ import annotations

import csv
import hashlib
import io
from typing import Iterable


def mask_email(value: str) -> str:
    """Mask email: show first 2 chars of local part, replace rest with *."""
    value = value.strip()
    if not value:
        return value

    if "@" not in value:
        return "***"

    local, domain = value.split("@", 1)
    if not local:
        return f"***@{domain}"

    visible = min(2, len(local))
    masked_local = local[:visible] + "*" * (len(local) - visible)
    return f"{masked_local}@{domain}"


def mask_phone(value: str) -> str:
    """Mask phone: replace last 7 digits with *."""
    value = value.strip()
    if not value or len(value) < 7:
        return value
    return value[:-7] + "*" * 7


def mask_name(value: str) -> str:
    """Mask full name: keep first letter of each word and replace the rest with *."""
    value = value.strip()
    if not value:
        return value

    parts = [part for part in value.split() if part]
    if len(parts) >= 1:
        return " ".join(part[0] + "*" * (len(part) - 1) for part in parts)

    return value[0] + "*" * (len(value) - 1)


def mask_digits(value: str) -> str:
    """Mask numeric value: keep first digit and replace rest with *."""
    value = value.strip()
    if not value or not value[0].isdigit():
        return value
    return value[0] + "*" * (len(value) - 1)


def mask_date(value: str) -> str:
    """Mask date: show year only (YYYY)."""
    value = value.strip()
    if not value:
        return value
    # Assume ISO format (YYYY-MM-DD) or just return first 4 chars
    if len(value) >= 4:
        return value[:4]
    return value


def mask_numeric(value: str) -> str:
    """Mask numeric amount: round to nearest 100 and show range."""
    value = value.strip()
    if not value:
        return value
    try:
        num = float(value)
        # Round to nearest 100
        lower = (int(num) // 100) * 100
        upper = lower + 100
        return f"{lower}-{upper}"
    except ValueError:
        return "***"



def anonymize_csv_with_masks(
    content: str,
    email_columns: Iterable[str] | None = None,
    phone_columns: Iterable[str] | None = None,
    name_columns: Iterable[str] | None = None,
    digits_columns: Iterable[str] | None = None,
    date_columns: Iterable[str] | None = None,
    numeric_columns: Iterable[str] | None = None,
) -> str:
    """Anonymize CSV with different masking methods per column."""
    source = io.StringIO(content)
    reader = csv.DictReader(source)

    if reader.fieldnames is None:
        raise ValueError("CSV не содержит заголовок")

    fields = [name.strip() for name in reader.fieldnames]
    email_cols = {name.strip() for name in (email_columns or []) if name.strip()}
    phone_cols = {name.strip() for name in (phone_columns or []) if name.strip()}
    name_cols = {name.strip() for name in (name_columns or []) if name.strip()}
    digits_cols = {name.strip() for name in (digits_columns or []) if name.strip()}
    date_cols = {name.strip() for name in (date_columns or []) if name.strip()}
    numeric_cols = {name.strip() for name in (numeric_columns or []) if name.strip()}

    # Check for unknown columns
    all_target_cols = email_cols | phone_cols | name_cols | digits_cols | date_cols | numeric_cols
    unknown = [name for name in all_target_cols if name not in fields]
    if unknown:
        raise ValueError(f"Неизвестные колонки: {', '.join(sorted(unknown))}")

    if not all_target_cols:
        raise ValueError("Выберите хотя бы одну колонку для маскирования")

    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()

    row_count = 0
    for row in reader:
        row_count += 1
        for col in email_cols:
            row[col] = mask_email(row.get(col, ""))
        for col in phone_cols:
            row[col] = mask_phone(row.get(col, ""))
        for col in name_cols:
            row[col] = mask_name(row.get(col, ""))
        for col in digits_cols:
            row[col] = mask_digits(row.get(col, ""))
        for col in date_cols:
            row[col] = mask_date(row.get(col, ""))
        for col in numeric_cols:
            row[col] = mask_numeric(row.get(col, ""))
        writer.writerow(row)

    if row_count == 0:
        raise ValueError("CSV пустой: нет строк данных")

    return out.getvalue()


def anonymize_csv_email_mask(content: str, target_columns: Iterable[str]) -> str:
    """Legacy function: mask email columns only."""
    return anonymize_csv_with_masks(content, email_columns=target_columns)


def _validate_target_columns(fields: list[str], target_columns: Iterable[str] | None) -> set[str]:
    cols = {name.strip() for name in (target_columns or []) if name.strip()}
    if not cols:
        raise ValueError("Выберите хотя бы одну колонку")

    unknown = [name for name in cols if name not in fields]
    if unknown:
        raise ValueError(f"Неизвестные колонки: {', '.join(sorted(unknown))}")

    return cols


def _pseudonymize_value(column: str, value: str, salt: str = "") -> str:
    value = (value or "").strip()
    if not value:
        return value

    digest = hashlib.sha256(f"{salt}:{column}:{value}".encode("utf-8")).hexdigest()[:10]
    return f"pseudo_{digest}"


def anonymize_csv_with_pseudonyms(
    content: str,
    target_columns: Iterable[str],
    salt: str = "",
) -> str:
    """Deterministic pseudonymization for selected columns."""
    source = io.StringIO(content)
    reader = csv.DictReader(source)

    if reader.fieldnames is None:
        raise ValueError("CSV не содержит заголовок")

    fields = [name.strip() for name in reader.fieldnames]
    target_cols = _validate_target_columns(fields, target_columns)

    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()

    row_count = 0
    for row in reader:
        row_count += 1
        for col in target_cols:
            row[col] = _pseudonymize_value(col, row.get(col, ""), salt=salt)
        writer.writerow(row)

    if row_count == 0:
        raise ValueError("CSV пустой: нет строк данных")

    return out.getvalue()


def anonymize_csv_with_removal(
    content: str,
    target_columns: Iterable[str],
    mode: str = "empty",
) -> str:
    """Remove selected columns or replace their values with empty strings."""
    source = io.StringIO(content)
    reader = csv.DictReader(source)

    if reader.fieldnames is None:
        raise ValueError("CSV не содержит заголовок")

    fields = [name.strip() for name in reader.fieldnames]
    target_cols = _validate_target_columns(fields, target_columns)

    if mode not in {"empty", "drop"}:
        raise ValueError("Режим удаления должен быть 'empty' или 'drop'")

    if mode == "drop":
        output_fields = [f for f in fields if f not in target_cols]
    else:
        output_fields = fields

    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=output_fields)
    writer.writeheader()

    row_count = 0
    for row in reader:
        row_count += 1
        if mode == "drop":
            filtered = {key: value for key, value in row.items() if key in output_fields}
            writer.writerow(filtered)
        else:
            for col in target_cols:
                row[col] = ""
            writer.writerow({key: row.get(key, "") for key in output_fields})

    if row_count == 0:
        raise ValueError("CSV пустой: нет строк данных")

    return out.getvalue()
