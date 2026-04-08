from __future__ import annotations

import csv
import io
import random
import string
from datetime import date
from datetime import datetime
from datetime import timedelta
from typing import Sequence

from faker import Faker


DEFAULT_EMAIL_DOMAINS = ["yandex.ru", "mail.ru", "rambler.ru", "gmail.com", "microsoft.com"]
ALLOWED_EMAIL_DOMAINS = tuple(DEFAULT_EMAIL_DOMAINS)
DEFAULT_COUNTRY_CODE = "7"


def generate_phone(country_code: str, prefix: str) -> str:
    """Generate phone in format +<country_code><10 digits> using custom prefix (1..3 digits)."""
    total_national_digits = 10
    remaining_len = total_national_digits - len(prefix)
    remaining = "".join(str(random.randint(0, 9)) for _ in range(remaining_len))
    return f"+{country_code}{prefix}{remaining}"


def generate_email(domains: Sequence[str]) -> str:
    """Generate email with ASCII-only local part and chosen domain."""
    if not domains:
        domains = DEFAULT_EMAIL_DOMAINS
    domain = random.choice(list(domains))
    local_part = "".join(random.choice(string.ascii_lowercase) for _ in range(8))
    return f"{local_part}{random.randint(1000, 9999)}@{domain}"


def generate_users_csv(
    rows: int,
    country_codes: Sequence[str] | None = None,
    phone_prefix: str | None = None,
    email_domains: Sequence[str] | None = None,
    registered_from: date | None = None,
    registered_to: date | None = None,
) -> str:
    fake = Faker("ru_RU")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["full_name", "email", "phone", "city", "registered_at"])

    if not country_codes:
        country_codes = [DEFAULT_COUNTRY_CODE]
    if email_domains is None:
        email_domains = DEFAULT_EMAIL_DOMAINS
    if registered_to is None:
        registered_to = date.today()
    if registered_from is None:
        registered_from = registered_to - timedelta(days=365 * 10)

    for _ in range(rows):
        name = fake.name()
        row_phone_prefix = phone_prefix
        if not row_phone_prefix:
            dynamic_prefix_len = random.randint(1, 3)
            row_phone_prefix = "".join(str(random.randint(0, 9)) for _ in range(dynamic_prefix_len))

        writer.writerow(
            [
                name,
                generate_email(email_domains),
                generate_phone(random.choice(list(country_codes)), row_phone_prefix),
                fake.city(),
                fake.date_between_dates(date_start=registered_from, date_end=registered_to).isoformat(),
            ]
        )

    return output.getvalue()


def generate_orders_csv(
    rows: int,
    user_id_start: int = 1,
) -> str:
    fake = Faker("ru_RU")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["order_id", "user_id", "date", "amount", "status"])

    statuses = ["new", "paid", "processing", "completed", "cancelled"]
    today = date.today()
    start_date = today - timedelta(days=365)

    for i in range(rows):
        order_id = i + 1
        user_id = random.randint(user_id_start, user_id_start + 1000)
        order_date = fake.date_between_dates(date_start=start_date, date_end=today).isoformat()
        amount = round(random.uniform(10.0, 1000.0), 2)
        status = random.choice(statuses)

        writer.writerow([order_id, user_id, order_date, amount, status])

    return output.getvalue()


def generated_filename(prefix: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{prefix}_{ts}.csv"
