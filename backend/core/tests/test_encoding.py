from django.test import TestCase, Client


class EncodingHeadersTests(TestCase):
    def setUp(self):
        self.client = Client()

    def assert_charset_utf8(self, response):
        ctype = (response.get("Content-Type") or "").lower()
        self.assertIn("charset=utf-8", ctype, f"Missing utf-8 charset in Content-Type: {ctype}")

    def assert_no_mojibake(self, text: str):
        # Common mojibake fragments if UTF-8 was decoded as cp1252/latin-1
        bad_fragments = ["â‚¹", "â€™", "â€œ", "â€", "Ã", "Â", "", "”¦", "”“"]
        for frag in bad_fragments:
            self.assertNotIn(frag, text, f"Found mojibake fragment {frag!r} in body")

    def test_company_packages_json_charset_and_rupee(self):
        # JSON API must declare UTF-8 and carry rupee sign correctly
        res = self.client.get("/api/company/packages/")
        self.assertEqual(res.status_code, 200)
        self.assert_charset_utf8(res)

        body = res.content.decode("utf-8")
        # Known rupee bearing text from the view
        self.assertIn("₹150", body)
        self.assert_no_mojibake(body)

    def test_company_info_json_charset(self):
        res = self.client.get("/api/company/")
        self.assertEqual(res.status_code, 200)
        self.assert_charset_utf8(res)

        body = res.content.decode("utf-8")
        self.assert_no_mojibake(body)

    def test_admin_login_html_charset(self):
        # HTML must declare UTF-8; even if redirect, follow to login page
        res = self.client.get("/admin/login/", follow=True)
        self.assertEqual(res.status_code, 200)
        self.assert_charset_utf8(res)

        body = res.content.decode("utf-8", errors="replace")
        self.assert_no_mojibake(body)
