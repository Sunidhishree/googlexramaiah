"""
Premium Certificate Generation Service for Ummeed Platform.
Generates formal, print-worthy PDF certificates using reportlab.
"""

import os
import math
import random
import textwrap
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

CERT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'certificates')

# ── Colour palette (RGB 0-1 range) ──
GOLD = (0.83, 0.68, 0.21)
GOLD_DARK = (0.7, 0.55, 0.1)
GOLD_LIGHT = (0.9, 0.85, 0.7)
BLACK_PANEL = (0.1, 0.1, 0.1)
NEAR_BLACK = (0.15, 0.15, 0.15)
DARK_GREY = (0.3, 0.3, 0.3)
MID_GREY = (0.4, 0.4, 0.4)
LIGHT_GREY = (0.6, 0.6, 0.6)
VERY_LIGHT = (0.85, 0.85, 0.85)
WATERMARK = (0.95, 0.93, 0.88)
WHITE = (1, 1, 1)


def _spaced(text):
    """Add letter spacing to a string for formal appearance."""
    return "   ".join(text.upper())


def _draw_gold_splatter(c, width, height):
    """Draw scattered gold dots in corners to simulate texture effect."""
    random.seed(42)  # Deterministic for consistent output
    c.saveState()

    clusters = [
        (width - 120, height - 120, 80),   # top-right
        (120, 80, 70),                       # bottom-left
        (width - 80, 60, 50),                # bottom-right (subtle)
    ]

    for cx, cy, spread in clusters:
        for _ in range(random.randint(35, 55)):
            x = cx + random.gauss(0, spread)
            y = cy + random.gauss(0, spread)
            r = random.uniform(0.8, 4.0)
            opacity = random.uniform(0.08, 0.25)
            c.setFillColorRGB(GOLD_LIGHT[0], GOLD_LIGHT[1], GOLD_LIGHT[2], opacity)
            c.circle(x, y, r, fill=1, stroke=0)

    c.restoreState()


def _draw_black_panel(c, height):
    """Draw the left vertical black sidebar with diagonal cut."""
    # Main panel
    c.setFillColorRGB(*BLACK_PANEL)
    c.rect(0, 0, 80, height, fill=1, stroke=0)

    # Diagonal cut at top
    p = c.beginPath()
    p.moveTo(80, height)
    p.lineTo(80, height - 115)
    p.lineTo(110, height)
    p.close()
    c.setFillColorRGB(*BLACK_PANEL)
    c.drawPath(p, fill=1, stroke=0)


def _draw_medal(c, cx, cy, outer_r):
    """Draw a gold medal with star center and ribbon."""
    # Outer gold ring
    c.setFillColorRGB(*GOLD)
    c.circle(cx, cy, outer_r, fill=1, stroke=0)

    # Inner dark ring
    c.setFillColorRGB(*GOLD_DARK)
    c.circle(cx, cy, outer_r * 0.82, fill=1, stroke=0)

    # Center gold fill
    c.setFillColorRGB(*GOLD)
    c.circle(cx, cy, outer_r * 0.65, fill=1, stroke=0)

    # Star in center (8-pointed)
    c.setFillColorRGB(*WHITE)
    star_r = outer_r * 0.38
    inner_star_r = star_r * 0.45
    points = 8
    path = c.beginPath()
    for i in range(points * 2):
        angle = math.pi / 2 + (math.pi * i / points)
        r = star_r if i % 2 == 0 else inner_star_r
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        if i == 0:
            path.moveTo(px, py)
        else:
            path.lineTo(px, py)
    path.close()
    c.setFillColorRGB(1, 1, 1, 0.9)
    c.drawPath(path, fill=1, stroke=0)

    # Ribbon tails below medal
    ribbon_y = cy - outer_r - 2
    c.setFillColorRGB(*BLACK_PANEL)
    # Left ribbon
    p1 = c.beginPath()
    p1.moveTo(cx - 12, ribbon_y)
    p1.lineTo(cx - 20, ribbon_y - 25)
    p1.lineTo(cx - 6, ribbon_y - 18)
    p1.close()
    c.drawPath(p1, fill=1, stroke=0)
    # Right ribbon
    p2 = c.beginPath()
    p2.moveTo(cx + 12, ribbon_y)
    p2.lineTo(cx + 20, ribbon_y - 25)
    p2.lineTo(cx + 6, ribbon_y - 18)
    p2.close()
    c.drawPath(p2, fill=1, stroke=0)


def _draw_user_signature(c, cx, y, user_name):
    """Draw the user's name in italic script as their signature."""
    # User name in elegant italic (simulating cursive signature)
    c.saveState()
    c.setFillColorRGB(0.2, 0.15, 0.35)  # Dark ink blue-purple
    c.setFont("Helvetica-BoldOblique", 16)

    # Auto-size if name is long
    sig_width = c.stringWidth(user_name, "Helvetica-BoldOblique", 16)
    if sig_width > 110:
        font_size = int(16 * 110 / sig_width)
        c.setFont("Helvetica-BoldOblique", max(10, font_size))

    c.drawCentredString(cx, y + 14, user_name)
    c.restoreState()

    # Straight line
    c.setStrokeColorRGB(*VERY_LIGHT)
    c.setLineWidth(0.5)
    c.line(cx - 60, y, cx + 60, y)

    # Label below
    c.setFillColorRGB(*LIGHT_GREY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(cx, y - 14, "Recipient")


def _draw_ummeed_signature(c, cx, y):
    """Draw Ummeed branding as the platform signature."""
    # Ummeed brand text
    c.saveState()
    c.setFillColorRGB(0.13, 0.25, 0.33)  # Ummeed dark teal
    c.setFont("Helvetica-Bold", 18)
    brand_text = "Ummeed"
    c.drawCentredString(cx - 4, y + 12, brand_text)

    # The dot in brand color
    dot_x = cx - 4 + c.stringWidth(brand_text, "Helvetica-Bold", 18) / 2 + 1
    c.setFillColorRGB(0.77, 0.44, 0.29)  # Ummeed accent orange
    c.setFont("Helvetica-Bold", 18)
    c.drawString(dot_x, y + 12, ".")
    c.restoreState()

    # Straight line
    c.setStrokeColorRGB(*VERY_LIGHT)
    c.setLineWidth(0.5)
    c.line(cx - 60, y, cx + 60, y)

    # Label below
    c.setFillColorRGB(*LIGHT_GREY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(cx, y - 14, "Ummeed Platform  \u2713")


def _draw_watermark(c, width, height):
    """Draw diagonal UMMEED watermark."""
    c.saveState()
    c.setFillColorRGB(*WATERMARK)
    c.setFont("Helvetica-Bold", 100)
    c.translate(width / 2, height / 2)
    c.rotate(30)
    c.drawCentredString(0, 0, "UMMEED")
    c.restoreState()


def generate_certificate(user_name, quest_title, orphanage_name, xp_earned, completion_date, user_id="user", quest_id="quest"):
    """
    Generate a premium formal PDF certificate.

    Args:
        user_name: Recipient's full name
        quest_title: Title of the completed quest
        orphanage_name: Supporting orphanage name
        xp_earned: XP points earned
        completion_date: Date of completion (datetime or string)
        user_id: User ID for filename
        quest_id: Quest ID for filename

    Returns:
        str: File path to the generated PDF, or None on failure.
    """
    try:
        os.makedirs(CERT_DIR, exist_ok=True)
        safe_title = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in quest_title[:20])
        filename = f"{user_id}_{safe_title}.pdf"
        filepath = os.path.join(CERT_DIR, filename)

        width, height = landscape(A4)  # 841.89 x 595.27
        c = canvas.Canvas(filepath, pagesize=landscape(A4))

        # ── 0. White background ──
        c.setFillColorRGB(*WHITE)
        c.rect(0, 0, width, height, fill=1, stroke=0)

        # ── 1. Gold splatter texture ──
        _draw_gold_splatter(c, width, height)

        # ── 2. Watermark (drawn early so everything sits on top) ──
        _draw_watermark(c, width, height)

        # ── 3. Left black panel with diagonal cut ──
        _draw_black_panel(c, height)

        # ── 4. Gold medal on panel edge ──
        _draw_medal(c, cx=80, cy=460, outer_r=40)

        # ── 5. Small gold seal at bottom center ──
        center_x = (80 + width) / 2  # Center of content area
        _draw_medal(c, cx=center_x, cy=85, outer_r=20)

        # ── 6. Header text ──
        content_center = (80 + width) / 2

        # "CERTIFICATE"
        c.setFillColorRGB(*NEAR_BLACK)
        c.setFont("Helvetica-Bold", 52)
        c.drawCentredString(content_center, 490, "CERTIFICATE")

        # "OF COMPASSION" with letter spacing
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(content_center, 455, _spaced("OF COMPASSION"))

        # Thin separator line
        c.setStrokeColorRGB(*VERY_LIGHT)
        c.setLineWidth(0.5)
        c.line(200, 443, 640, 443)

        # ── 7. Middle section ──

        # "THIS CERTIFICATE IS PRESENTED TO"
        c.setFillColorRGB(*DARK_GREY)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(content_center, 415, _spaced("THIS CERTIFICATE IS PRESENTED TO"))

        # Recipient name (large, bold italic for cursive feel)
        c.setFillColorRGB(*NEAR_BLACK)
        c.setFont("Helvetica-BoldOblique", 48)

        # Adjust font size if name is very long
        name_font_size = 48
        name_width = c.stringWidth(user_name, "Helvetica-BoldOblique", name_font_size)
        max_name_width = width - 200
        if name_width > max_name_width:
            name_font_size = int(name_font_size * max_name_width / name_width)
            c.setFont("Helvetica-BoldOblique", name_font_size)

        c.drawCentredString(content_center, 355, user_name)

        # Underline below name
        actual_name_width = c.stringWidth(user_name, "Helvetica-BoldOblique", name_font_size)
        c.setStrokeColorRGB(*LIGHT_GREY)
        c.setLineWidth(0.5)
        c.line(content_center - actual_name_width / 2 - 30, 347,
               content_center + actual_name_width / 2 + 30, 347)

        # Quest + orphanage description
        desc_text = f'for successfully completing  "{quest_title}"  in support of  {orphanage_name}'
        c.setFillColorRGB(*MID_GREY)
        c.setFont("Helvetica", 11)

        if c.stringWidth(desc_text, "Helvetica", 11) > max_name_width:
            lines = textwrap.wrap(desc_text, width=75)
            for i, line in enumerate(lines[:3]):
                c.drawCentredString(content_center, 310 - (i * 16), line)
            desc_bottom_y = 310 - (len(lines[:3]) * 16)
        else:
            c.drawCentredString(content_center, 310, desc_text)
            desc_bottom_y = 310

        # XP earned pill
        xp_text = f"  {xp_earned} XP EARNED  "
        pill_y = desc_bottom_y - 30
        pill_w = c.stringWidth(xp_text, "Helvetica-Bold", 11) + 24
        pill_h = 22
        pill_x = content_center - pill_w / 2
        pill_r = pill_h / 2

        # Draw rounded pill background
        c.setFillColorRGB(*GOLD)
        c.roundRect(pill_x, pill_y - pill_h / 2, pill_w, pill_h, pill_r, fill=1, stroke=0)

        # Pill text
        c.setFillColorRGB(*WHITE)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(content_center, pill_y - 4, xp_text)

        # XP earned + Ummeed platform line
        c.setFillColorRGB(*LIGHT_GREY)
        c.setFont("Helvetica", 9)
        c.drawCentredString(content_center, pill_y - 24, "earned on the Ummeed Welfare & Community Care platform")

        # ── 8. Footer: Signatures ──
        sig_y = 120
        left_sig_x = 240
        right_sig_x = width - 160

        _draw_user_signature(c, left_sig_x, sig_y, user_name)
        _draw_ummeed_signature(c, right_sig_x, sig_y)

        # Date bottom-right
        if isinstance(completion_date, datetime):
            date_str = completion_date.strftime("%B %d, %Y")
        else:
            date_str = str(completion_date)

        c.setFillColorRGB(*LIGHT_GREY)
        c.setFont("Helvetica", 8)
        c.drawString(700, 30, f"Issued on {date_str}")

        # Ummeed branding bottom-left (in the panel area)
        c.saveState()
        c.setFillColorRGB(1, 1, 1, 0.5)
        c.setFont("Helvetica-Bold", 7)
        c.translate(20, 60)
        c.rotate(90)
        c.drawString(0, 0, "UMMEED.ORG")
        c.restoreState()

        # ── Finalize ──
        c.showPage()
        c.save()

        print(f"[Certificate] Generated premium certificate for {user_name}: {filepath}")
        return filepath

    except Exception as e:
        print(f"[Certificate] Error generating certificate: {e}")
        return None
