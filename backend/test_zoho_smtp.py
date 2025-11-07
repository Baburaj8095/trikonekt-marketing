import smtplib
from email.mime.text import MIMEText

# === CONFIGURATION ===
SMTP_HOST = "smtp.zoho.in"   # use smtp.zoho.in or smtp.zoho.eu if applicable
SMTP_PORT = 587               # 465 if using SSL
USE_TLS = True

FROM_EMAIL = "contact@trikonekt.com"
PASSWORD = "Trikonekt@2025"  # use App Password if 2FA is enabled
TO_EMAIL = "baburajnk19@gmail.com"  # e.g., your Gmail

# === MESSAGE ===
subject = "✅ Zoho SMTP Test Successful"
body = (
    "Hi!\n\n"
    "This is a test email sent directly via Zoho SMTP.\n\n"
    "If you received this, your credentials and settings are correct.\n\n"
    "— trikonekt backend test"
)

msg = MIMEText(body)
msg["Subject"] = subject
msg["From"] = FROM_EMAIL
msg["To"] = TO_EMAIL

# === SEND ===
try:
    if USE_TLS:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
    else:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)

    server.login(FROM_EMAIL, PASSWORD)
    server.send_message(msg)
    server.quit()

    print("✅ Email sent successfully to", TO_EMAIL)

except smtplib.SMTPAuthenticationError as e:
    print("❌ Authentication failed — check email/password or Zoho region.")
    print("Details:", e)
except Exception as e:
    print("❌ Error sending email:")
    print(e)
