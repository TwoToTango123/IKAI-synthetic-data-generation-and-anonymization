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
    """Mask date: keep year and replace remaining digits with *."""
    value = value.strip()
    if not value:
        return value

    # For ISO dates like YYYY-MM-DD return YYYY-**-**
    if len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return f"{value[:4]}-**-**"

    # Generic fallback: keep first 4 chars, mask the rest preserving separators.
    result = []
    for i, ch in enumerate(value):
        if i < 4:
            result.append(ch)
        elif ch.isalnum():
            result.append("*")
        else:
            result.append(ch)
    return "".join(result)


def mask_numeric(value: str) -> str:
    """Mask numeric amount: keep first digit, replace remaining digits with *."""
    value = value.strip()
    if not value:
        return value

    first_digit_seen = False
    masked = []
    for ch in value:
        if ch.isdigit():
            if not first_digit_seen:
                masked.append(ch)
                first_digit_seen = True
            else:
                masked.append("*")
        else:
            masked.append(ch)

    if not first_digit_seen:
        return "***"
    return "".join(masked)



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


def _normalize_fieldnames(fieldnames: list[str] | None) -> list[str]:
    return [name.strip() for name in (fieldnames or []) if name and name.strip()]


def _detect_best_delimiter(cleaned_content: str, target_columns: set[str] | None = None) -> str:
    candidates = [",", ";", "\t", "|"]
    best_delimiter = ","
    best_score = (-1, -1)

    for delimiter in candidates:
        reader = csv.DictReader(io.StringIO(cleaned_content), delimiter=delimiter)
        fields = _normalize_fieldnames(reader.fieldnames)
        if not fields:
            continue

        matched = len(set(fields) & (target_columns or set()))
        score = (matched, len(fields))
        if score > best_score:
            best_score = score
            best_delimiter = delimiter

    return best_delimiter


def _read_csv_dict_reader(content: str, target_columns: set[str] | None = None) -> csv.DictReader[str]:
    cleaned_content = content.lstrip("\ufeff")
    delimiter = _detect_best_delimiter(cleaned_content, target_columns)
    return csv.DictReader(io.StringIO(cleaned_content), delimiter=delimiter)


def extract_csv_headers(content: str, target_columns: Iterable[str] | None = None) -> list[str]:
    """Extract CSV headers using the same delimiter detection as anonymization."""
    target_cols = {name.strip() for name in (target_columns or []) if name.strip()}
    reader = _read_csv_dict_reader(content, target_cols)
    return [name.strip() for name in (reader.fieldnames or []) if name and name.strip()]


def _normalize_target_columns(target_columns: Iterable[str] | None) -> set[str]:
    cols = {name.strip() for name in (target_columns or []) if name.strip()}
    if not cols:
        raise ValueError("Выберите хотя бы одну колонку")

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
    target_cols = _normalize_target_columns(target_columns)
    reader = _read_csv_dict_reader(content, target_cols)

    if reader.fieldnames is None:
        raise ValueError("CSV не содержит заголовок")

    fields = [name.strip() for name in reader.fieldnames]
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()

    row_count = 0
    for row in reader:
        row_count += 1
        for col in target_cols:
            if col not in fields:
                continue
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
    target_cols = _normalize_target_columns(target_columns)
    reader = _read_csv_dict_reader(content, target_cols)

    if reader.fieldnames is None:
        raise ValueError("CSV не содержит заголовок")

    fields = [name.strip() for name in reader.fieldnames]
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
                if col not in fields:
                    continue
                row[col] = ""
            writer.writerow({key: row.get(key, "") for key in output_fields})

    if row_count == 0:
        raise ValueError("CSV пустой: нет строк данных")

    return out.getvalue()
