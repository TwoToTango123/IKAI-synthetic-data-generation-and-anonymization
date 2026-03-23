from __future__ import annotations

import csv
import io
import random
from datetime import datetime
from typing import Sequence

from faker import Faker


DEFAULT_EMAIL_DOMAINS = ["yandex.ru", "mail.ru", "rambler.ru", "gmail.com", "microsoft.com"]
DEFAULT_PHONE_FIRST_DIGITS = [str(i) for i in range(10)]  # 0-9
VALID_PHONE_FIRST_DIGITS = [str(i) for i in range(10)]  # 0-9


def generate_phone(first_digit: str) -> str:
    """Generate phone in format +7{first_digit}XXXXXXXX (11 digits total)."""
    remaining = "".join(str(random.randint(0, 9)) for _ in range(8))
    return f"+7{first_digit}{remaining}"


def generate_email(name: str, domains: Sequence[str]) -> str:
    """Generate email with chosen domain."""
    if not domains:
        domains = DEFAULT_EMAIL_DOMAINS
    domain = random.choice(list(domains))
    # Use first part of name to avoid collisions
    name_part = name.split()[0].lower() if name else "user"
    return f"{name_part}{random.randint(1000, 9999)}@{domain}"


def generate_users_csv(
    rows: int,
    phone_first_digits: Sequence[str] | None = None,
    email_domains: Sequence[str] | None = None,
) -> str:
    fake = Faker("ru_RU")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["full_name", "email", "phone", "city", "registered_at"])

    if phone_first_digits is None:
        phone_first_digits = DEFAULT_PHONE_FIRST_DIGITS
    if email_domains is None:
        email_domains = DEFAULT_EMAIL_DOMAINS

    for _ in range(rows):
        name = fake.name()
        writer.writerow(
            [
                name,
                generate_email(name, email_domains),
                generate_phone(random.choice(list(phone_first_digits))),
                fake.city(),
                fake.date_between(start_date="-2y", end_date="today").isoformat(),
            ]
        )

    return output.getvalue()


def generated_filename(prefix: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{prefix}_{ts}.csv"
