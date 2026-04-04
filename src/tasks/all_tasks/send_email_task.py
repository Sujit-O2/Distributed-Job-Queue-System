import mimetypes
import smtplib
from email.message import EmailMessage
from pathlib import Path

from src.tasks.base_task import BaseTask


class SendEmailTask(BaseTask):
    def validate(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        required_fields = ["smtp_host", "from_email", "to_email", "subject"]
        missing = [field for field in required_fields if field not in payload]
        if missing:
            raise ValueError(f"Missing fields: {', '.join(missing)}")

    def execute(self, payload):
        smtp_host = payload["smtp_host"]
        smtp_port = int(payload.get("smtp_port", 587))
        username = payload.get("username")
        password = payload.get("password")
        use_tls = payload.get("use_tls", True)
        dry_run = payload.get("dry_run", False)

        message = EmailMessage()
        message["Subject"] = payload["subject"]
        message["From"] = payload["from_email"]
        message["To"] = payload["to_email"]
        message.set_content(payload.get("body", ""))

        html_body = payload.get("html_body")
        if html_body:
            message.add_alternative(html_body, subtype="html")

        for attachment_path in payload.get("attachments", []):
            path = Path(attachment_path)
            mime_type, _ = mimetypes.guess_type(path.name)
            maintype, subtype = (mime_type or "application/octet-stream").split("/", 1)
            message.add_attachment(path.read_bytes(), maintype=maintype, subtype=subtype, filename=path.name)

        if dry_run:
            return {
                "dry_run": True,
                "smtp_host": smtp_host,
                "smtp_port": smtp_port,
                "to_email": payload["to_email"],
                "subject": payload["subject"],
                "attachment_count": len(payload.get("attachments", [])),
            }

        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)

        return {
            "sent": True,
            "to_email": payload["to_email"],
            "subject": payload["subject"],
            "attachment_count": len(payload.get("attachments", [])),
        }
