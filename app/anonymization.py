from __future__ import annotations

import csv
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


def anonymize_csv_with_masks(
    content: str,
    email_columns: Iterable[str] | None = None,
    phone_columns: Iterable[str] | None = None,
    name_columns: Iterable[str] | None = None,
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

    # Check for unknown columns
    all_target_cols = email_cols | phone_cols | name_cols
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
        writer.writerow(row)

    if row_count == 0:
        raise ValueError("CSV пустой: нет строк данных")

    return out.getvalue()


def anonymize_csv_email_mask(content: str, target_columns: Iterable[str]) -> str:
    """Legacy function: mask email columns only."""
    return anonymize_csv_with_masks(content, email_columns=target_columns)
