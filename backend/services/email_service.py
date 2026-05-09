"""
Email Service for Ummeed Platform.
Sends certificate emails with PDF attachments via SMTP.
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication


def send_certificate_email(user_email, user_name, quest_title, xp_earned, pdf_path=None):
    """
    Send a certificate email with optional PDF attachment.

    Args:
        user_email: Recipient email address
        user_name: Recipient name
        quest_title: Title of the completed quest
        xp_earned: XP points earned
        pdf_path: Path to the PDF certificate (optional)

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    smtp_host = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USERNAME", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("FROM_EMAIL", smtp_user)
    use_ssl = os.getenv("SMTP_USE_SSL", "true").lower() in ("true", "1", "yes")

    if not smtp_user or not smtp_pass:
        print("[Email] SMTP credentials not configured. Skipping email.")
        return False

    if not user_email:
        print("[Email] No recipient email provided. Skipping.")
        return False

    try:
        # Build message
        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["To"] = user_email
        msg["Subject"] = f"\U0001f3c5 Your Ummeed Certificate \u2014 {quest_title}"

        html_body = f"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #204155, #3b6b88); padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Ummeed<span style="color: #C4714A;">.</span></h1>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Welfare & Community Care</p>
            </div>

            <div style="background: #ffffff; padding: 32px; border: 1px solid #e8e8e8; border-top: none;">
                <p style="font-size: 16px; color: #333;">Hi <strong>{user_name}</strong>! \U0001f44b</p>

                <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Congratulations on completing your quest on Ummeed! \U0001f389<br>
                    You made a real difference. Your certificate is attached below.
                </p>

                <div style="background: #f8f6f3; border-left: 4px solid #C4714A; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Quest Completed:</p>
                    <p style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #204155;">{quest_title}</p>
                    <p style="margin: 0; font-size: 14px; color: #666;">XP Earned: <strong style="color: #D4A843; font-size: 16px;">{xp_earned} XP</strong></p>
                </div>

                <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Keep going \u2014 every action counts. \U0001f31f
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

                <p style="font-size: 13px; color: #999; text-align: center;">
                    With gratitude,<br>
                    <strong style="color: #204155;">Team Ummeed</strong>
                </p>
            </div>

            <div style="background: #f5f3f0; padding: 12px; border-radius: 0 0 12px 12px; text-align: center;">
                <p style="font-size: 11px; color: #aaa; margin: 0;">Spreading hope to those who need it most</p>
            </div>
        </div>
        """

        msg.attach(MIMEText(html_body, "html"))

        # Attach PDF if available
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
                pdf_filename = os.path.basename(pdf_path)
                pdf_attachment.add_header("Content-Disposition", "attachment", filename=f"Ummeed_Certificate_{pdf_filename}")
                msg.attach(pdf_attachment)
                print(f"[Email] PDF attached: {pdf_filename}")
        else:
            print(f"[Email] No PDF attachment (path: {pdf_path})")

        # Send via SMTP
        if use_ssl:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()

        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()

        print(f"[Email] Certificate email sent to {user_email}")
        return True

    except Exception as e:
        print(f"[Email] Failed to send email to {user_email}: {e}")
        return False
