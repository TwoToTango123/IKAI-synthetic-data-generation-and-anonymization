import unittest
import json

from fastapi.testclient import TestClient

from app.main import app


class ApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health_returns_ok(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_generate_returns_csv(self) -> None:
        response = self.client.get("/generate?rows=2&template=users")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response.headers["content-type"])
        self.assertIn("full_name,email,phone,city,registered_at", response.text)

    def test_generate_rejects_zero_rows_with_clear_message(self) -> None:
        response = self.client.get("/generate?rows=0&template=users")

        self.assertEqual(response.status_code, 400)
        self.assertIn("не может быть равно 0", response.json()["detail"])

    def test_generate_rejects_too_many_rows_with_clear_message(self) -> None:
        response = self.client.get("/generate?rows=100001&template=users")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Максимально допустимо: 100000", response.json()["detail"])

    def test_anonymize_masks_requested_columns(self) -> None:
        csv_content = (
            "full_name,email,phone\n"
            "Ivan Ivanov,ivan@example.com,+7991234567\n"
        )

        response = self.client.post(
            "/anonymize",
            files={"file": ("users.csv", csv_content, "text/csv")},
            data={
                "email_columns": "email",
                "phone_columns": "phone",
                "name_columns": "full_name",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("iv**@example.com", response.text)
        self.assertIn("+799*******", response.text)
        self.assertIn("I*** I*****", response.text)

    def test_validate_json_returns_success_for_valid_payload(self) -> None:
        payload = {
            "full_name": "Ivan Ivanov",
            "email": "ivan@example.com",
            "phone": "+7991234567",
            "city": "Moscow",
            "registered_at": "2024-01-10",
        }

        response = self.client.post("/validate-json?template=users", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["valid"])

    def test_pseudonymization_can_be_reversed_with_mapping_id(self) -> None:
        source_csv = (
            "full_name,email,phone\n"
            "Ivan Ivanov,ivan@example.com,+7991234567\n"
            "Petr Petrov,petr@example.com,+7997654321\n"
        )

        pseudo_response = self.client.post(
            "/anonymize",
            files={"file": ("users.csv", source_csv, "text/csv")},
            data={
                "method": "pseudonymization",
                "target_columns": "email,phone",
                "pseudonym_salt": "test-salt",
            },
        )

        self.assertEqual(pseudo_response.status_code, 200)
        pseudo_payload = pseudo_response.json()
        self.assertIn("csv", pseudo_payload)
        self.assertIn("mapping", pseudo_payload)
        self.assertIn("pseudo_", pseudo_payload["csv"])
        self.assertNotIn("ivan@example.com", pseudo_payload["csv"])

        restore_response = self.client.post(
            "/deanonymize",
            files={"file": ("anon_users.csv", pseudo_payload["csv"], "text/csv")},
            data={"mapping": json.dumps(pseudo_payload["mapping"])},
        )

        self.assertEqual(restore_response.status_code, 200)
        self.assertIn("ivan@example.com", restore_response.text)
        self.assertIn("petr@example.com", restore_response.text)
        self.assertIn("+7991234567", restore_response.text)

    def test_deanonymize_fails_with_invalid_mapping(self) -> None:
        pseudo_csv = "email\npseudo_deadbeef\n"
        response = self.client.post(
            "/deanonymize",
            files={"file": ("anon.csv", pseudo_csv, "text/csv")},
            data={"mapping": "{}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("отсутствуют данные по колонкам", response.json()["detail"])

    def test_generate_is_rate_limited(self) -> None:
        headers = {"X-Forwarded-For": "203.0.113.50"}
        statuses = []

        for _ in range(21):
            response = self.client.get("/generate?rows=1&template=users", headers=headers)
            statuses.append(response.status_code)

        self.assertEqual(statuses.count(429), 1)
        self.assertEqual(statuses[-1], 429)


if __name__ == "__main__":
    unittest.main()
