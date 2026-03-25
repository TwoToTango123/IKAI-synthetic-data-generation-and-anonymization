import unittest

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
        response = self.client.get("/generate?rows=2&phone_first_digits=9&email_domains=gmail.com")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response.headers["content-type"])
        self.assertIn("full_name,email,phone,city,registered_at", response.text)

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
        self.assertIn("Iv*********@example.com", response.text)
        self.assertIn("+799*******", response.text)
        self.assertIn("I**********", response.text)

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


if __name__ == "__main__":
    unittest.main()
