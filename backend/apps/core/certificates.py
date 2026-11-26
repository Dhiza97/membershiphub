from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas


PURPLE = colors.HexColor("#720061")
INK = colors.HexColor("#090909")
GOLD = colors.HexColor("#c59a24")


def render_certificate_pdf(certificate, verification_url):
    buffer = BytesIO()
    page_width, page_height = landscape(A4)
    document = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    document.setTitle(f"Certificate {certificate.certificate_number}")
    document.setAuthor("MembershipHub")

    document.setStrokeColor(PURPLE)
    document.setLineWidth(3)
    document.rect(28, 28, page_width - 56, page_height - 56)
    document.setStrokeColor(GOLD)
    document.setLineWidth(1)
    document.rect(36, 36, page_width - 72, page_height - 72)

    center = page_width / 2
    document.setFillColor(PURPLE)
    document.setFont("Helvetica-Bold", 14)
    document.drawCentredString(center, page_height - 105, "MEMBERSHIPHUB")
    document.setFillColor(INK)
    document.setFont("Helvetica-Bold", 29)
    document.drawCentredString(center, page_height - 165, "CERTIFICATE OF COMPLETION")
    document.setFont("Helvetica", 13)
    document.drawCentredString(center, page_height - 210, "This certifies that")
    document.setFillColor(PURPLE)
    document.setFont("Helvetica-Bold", 27)
    document.drawCentredString(center, page_height - 255, certificate.student_name)
    document.setFillColor(INK)
    document.setFont("Helvetica", 13)
    document.drawCentredString(center, page_height - 292, "has successfully completed")
    document.setFont("Helvetica-Bold", 17)
    document.drawCentredString(center, page_height - 321, certificate.cohort_name)
    document.setFont("Helvetica", 12)
    document.drawCentredString(center, page_height - 347, certificate.branch_name)

    document.setStrokeColor(colors.HexColor("#e6e2e7"))
    document.line(95, 106, page_width - 95, 106)
    document.setFillColor(INK)
    document.setFont("Helvetica-Bold", 10)
    document.drawString(100, 84, f"Certificate number: {certificate.certificate_number}")
    document.drawString(100, 67, f"Issued: {certificate.issued_at:%B %d, %Y}")
    document.setFont("Helvetica", 9)
    document.drawRightString(page_width - 100, 84, f"Verification reference: {certificate.verification_code}")
    document.drawRightString(page_width - 100, 67, verification_url[:110])
    document.save()
    return buffer.getvalue()