import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Group, Circle, Polygon

pdf_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\Trikonekt_5_Directs_Tree_and_Financial_Report.pdf"

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    rightMargin=24,
    leftMargin=24,
    topMargin=20,
    bottomMargin=20
)

styles = getSampleStyleSheet()

t_main = ParagraphStyle('TMain', fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=colors.HexColor('#0f172a'), alignment=TA_CENTER)
t_sub  = ParagraphStyle('TSub', fontName='Helvetica', fontSize=8.5, leading=11, textColor=colors.HexColor('#475569'), alignment=TA_CENTER)

h1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=colors.HexColor('#1e1b4b'), spaceBefore=4, spaceAfter=3)
h2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=9, leading=11.5, textColor=colors.HexColor('#0369a1'), spaceBefore=3, spaceAfter=2)

body = ParagraphStyle('B', fontName='Helvetica', fontSize=7.2, leading=9.5, textColor=colors.HexColor('#1e293b'))
body_bold = ParagraphStyle('BB', fontName='Helvetica-Bold', fontSize=7.2, leading=9.5, textColor=colors.HexColor('#0f172a'))

box_head = ParagraphStyle('BH', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=colors.white, alignment=TA_CENTER)
box_desc = ParagraphStyle('BD', fontName='Helvetica', fontSize=6.8, leading=8.8, textColor=colors.HexColor('#1e293b'), alignment=TA_CENTER)
box_bold = ParagraphStyle('BDB', fontName='Helvetica-Bold', fontSize=7.2, leading=9.2, textColor=colors.HexColor('#0f172a'), alignment=TA_CENTER)

th = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=7.2, leading=9.2, textColor=colors.white, alignment=TA_CENTER)
td = ParagraphStyle('TD', fontName='Helvetica', fontSize=6.8, leading=8.8, textColor=colors.HexColor('#0f172a'))
td_c = ParagraphStyle('TDC', parent=td, alignment=TA_CENTER)
td_r = ParagraphStyle('TDR', parent=td, alignment=TA_RIGHT)
td_b = ParagraphStyle('TDB', parent=td, fontName='Helvetica-Bold')
td_bc = ParagraphStyle('TDBC', parent=td, fontName='Helvetica-Bold', alignment=TA_CENTER)

elements = []

# =========================================================================
# PAGE 1: TITLE, 2K PACKAGE FLOW & THE 5 DIRECT MEMBERS SETUP
# =========================================================================
elements.append(Paragraph('TRIKONEKT 5 DIRECT SPONSORS TREE ARCHITECTURE', t_main))
elements.append(Spacer(1, 1))
elements.append(Paragraph('Complete Step-by-Step Tree Evolution, Progressive Matrix Placements & Financial Proof', t_sub))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1e1b4b'), spaceBefore=3, spaceAfter=4))

elements.append(Paragraph('1. Simulation Setup: Root Sponsor (9999999999) Sponsoring 5 Directs (9999999991 - 9999999995)', h1))
elements.append(Paragraph(
    '• <b>Root Sponsor (9999999999)</b> registers 5 direct members one by one. <b>No package was purchased for 9999999999</b>.<br/>'
    '• Each direct member purchases the exact <b>₹2,000 Base Package</b> (₹750 Join Prime + ₹1,000 Monthly SPP + ₹250 e-Edu Layer 1).<br/>'
    '• Every purchase creates <b>1 entry in Tree 1 (5-Matrix)</b>, <b>1 entry in Tree 2 (3-Matrix)</b>, and <b>1 entry in Tree 3 (e-Edu 5-Matrix)</b>.',
    body
))
elements.append(Spacer(1, 3))

# Package breakdown table
pkg_flow_data = [
    [Paragraph('<b>₹2,000 BASE COMBO PACKAGE (PURCHASED BY EACH DIRECT MEMBER)</b>', box_head), Paragraph('', box_head), Paragraph('', box_head)],
    [Paragraph('<b>PART 1: ₹750 Join Prime</b>', box_bold), Paragraph('<b>PART 2: ₹1,000 Monthly SPP</b>', box_bold), Paragraph('<b>PART 3: ₹250 e-Edu Layer 1</b>', box_bold)],
    [Paragraph('<b>Matrix Entries:</b><br/>• <b>Tree 1: 5-Matrix Seat</b><br/>• <b>Tree 2: 3-Matrix Seat</b><br/><br/><b>Commissions Generated:</b><br/>• Direct Sponsor: <b>₹150.00</b><br/>• 5-Matrix Autopool: <b>₹30.00</b><br/>• 3-Matrix Autopool: <b>₹10.00</b>', box_desc),
     Paragraph('<b>1st Month Matrix Opening:</b><br/>• Opens 5M & 3M based on 1st month Admin Distribute config<br/><br/><b>Commissions Generated:</b><br/>• Direct Sponsor: <b>₹100.00</b><br/>• Product Voucher to User<br/>• Feeds Monthly 11:59 PM Pools', box_desc),
     Paragraph('<b>Matrix Entry:</b><br/>• <b>Tree 3: e-Edu 5-Matrix Seat</b> (in Root\'s personal rank tree)<br/><br/><b>Commissions Generated:</b><br/>• 50% Direct Sponsor: <b>₹125.00</b><br/>• 50% Layer 1 Match: <b>₹125.00</b><br/>• Unlocks L1 LMS Education', box_desc)],
]
t_pkg = Table(pkg_flow_data, colWidths=[188, 188, 188])
t_pkg.setStyle(TableStyle([
    ('SPAN', (0,0), (2,0)),
    ('BACKGROUND', (0,0), (2,0), colors.HexColor('#1e1b4b')),
    ('BACKGROUND', (0,1), (0,1), colors.HexColor('#bae6fd')),
    ('BACKGROUND', (1,1), (1,1), colors.HexColor('#fbcfe8')),
    ('BACKGROUND', (2,1), (2,1), colors.HexColor('#fed7aa')),
    ('BACKGROUND', (0,2), (0,2), colors.HexColor('#f0f9ff')),
    ('BACKGROUND', (1,2), (1,2), colors.HexColor('#fdf2f8')),
    ('BACKGROUND', (2,2), (2,2), colors.HexColor('#fff7ed')),
    ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
]))
elements.append(t_pkg)
elements.append(Spacer(1, 4))

elements.append(Paragraph('2. Summary of the 5 Direct Members Sponsored Under 9999999999', h1))
members_summary = [
    [Paragraph('Step #', th), Paragraph('Member Phone', th), Paragraph('Sponsor Phone', th), Paragraph('Package Paid', th), Paragraph('Tree 1 (5M)', th), Paragraph('Tree 2 (3M)', th), Paragraph('Tree 3 (e-Edu)', th), Paragraph('Root Balance After', th)],
    [Paragraph('<b>Step 1</b>', td_c), Paragraph('<b>9999999991</b>', td_b), Paragraph('9999999999', td_c), Paragraph('₹2,000.00', td_r), Paragraph('Seat #115 (Pos 1)', td_c), Paragraph('Seat #116 (Pos 3)', td_c), Paragraph('Node #10 (Pos 1)', td_c), Paragraph('<b>₹565.00</b>', td_r)],
    [Paragraph('<b>Step 2</b>', td_c), Paragraph('<b>9999999992</b>', td_b), Paragraph('9999999999', td_c), Paragraph('₹2,000.00', td_r), Paragraph('Seat #119 (Pos 1)', td_c), Paragraph('Seat #120 (Pos 2)', td_c), Paragraph('Node #11 (Pos 2)', td_c), Paragraph('<b>₹945.00</b>', td_r)],
    [Paragraph('<b>Step 3</b>', td_c), Paragraph('<b>9999999993</b>', td_b), Paragraph('9999999999', td_c), Paragraph('₹2,000.00', td_r), Paragraph('Seat #123 (Pos 1)', td_c), Paragraph('Seat #124 (Pos 1)', td_c), Paragraph('Node #12 (Pos 3)', td_c), Paragraph('<b>₹1,510.00</b>', td_r)],
    [Paragraph('<b>Step 4</b>', td_c), Paragraph('<b>9999999994</b>', td_b), Paragraph('9999999999', td_c), Paragraph('₹2,000.00', td_r), Paragraph('Seat #127 (Pos 1)', td_c), Paragraph('Seat #128 (Pos 3)', td_c), Paragraph('Node #13 (Pos 4)', td_c), Paragraph('<b>₹1,890.00</b>', td_r)],
    [Paragraph('<b>Step 5</b>', td_c), Paragraph('<b>9999999995</b>', td_b), Paragraph('9999999999', td_c), Paragraph('₹2,000.00', td_r), Paragraph('Seat #131 (Pos 1)', td_c), Paragraph('Seat #132 (Pos 2)', td_c), Paragraph('Node #14 (Pos 5)', td_c), Paragraph('<b>₹2,455.00</b>', td_r)],
    [Paragraph('<b>TOTAL</b>', td_bc), Paragraph('<b>5 Directs</b>', td_bc), Paragraph('<b>9999999999</b>', td_bc), Paragraph('<b>₹10,000.00</b>', td_bc), Paragraph('<b>5 Seats</b>', td_bc), Paragraph('<b>5 Seats</b>', td_bc), Paragraph('<b>5 Nodes (Full)</b>', td_bc), Paragraph('<b>₹2,455.00 Net</b>', td_bc)],
]
t_mem_sum = Table(members_summary, colWidths=[40, 75, 75, 65, 75, 75, 75, 84])
t_mem_sum.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e1b4b')),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#f8fafc')]),
    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#dcfce7')),
    ('TOPPADDING', (0,0), (-1,-1), 2.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
]))
elements.append(t_mem_sum)

# =========================================================================
# PAGE 2: STEP-BY-STEP EVOLUTION (STEPS 1, 2, 3)
# =========================================================================
elements.append(PageBreak())
elements.append(Paragraph('STEP-BY-STEP TREE EVOLUTION: STEPS 1 TO 3', t_main))
elements.append(Paragraph('Visual State of the 3 Trees as Users 9999999991, 9999999992, and 9999999993 Join', t_sub))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#0284c7'), spaceBefore=3, spaceAfter=4))

# STEP 1 DIAGRAM
d_step1 = Drawing(564, 90)
d_step1.add(Rect(0, 0, 564, 90, rx=4, ry=4, fillColor=colors.HexColor('#f0f9ff'), strokeColor=colors.HexColor('#bae6fd'), strokeWidth=1))
d_step1.add(Rect(5, 65, 120, 20, rx=3, ry=3, fillColor=colors.HexColor('#0284c7'), strokeColor=None))
d_step1.add(String(65, 71, 'STEP 1: User 9999999991 Joins', fontName='Helvetica-Bold', fontSize=7, textAnchor='middle', fillColor=colors.white))

# Tree 1 Box
d_step1.add(Rect(135, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#0284c7'), strokeWidth=0.8))
d_step1.add(String(202, 68, 'Tree 1: 5-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step1.add(Rect(145, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step1.add(String(202, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step1.add(Line(202, 42, 202, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step1.add(Rect(145, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#bae6fd'), strokeColor=None))
d_step1.add(String(202, 17, 'Pos 1: 9999999991 (Seat #115)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))

# Tree 2 Box
d_step1.add(Rect(280, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#7c3aed'), strokeWidth=0.8))
d_step1.add(String(347, 68, 'Tree 2: 3-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
d_step1.add(Rect(290, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step1.add(String(347, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step1.add(Line(347, 42, 347, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step1.add(Rect(290, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#ede9fe'), strokeColor=None))
d_step1.add(String(347, 17, 'Pos 1: 9999999991 (Seat #116)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))

# Tree 3 Box
d_step1.add(Rect(425, 10, 130, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#ea580c'), strokeWidth=0.8))
d_step1.add(String(490, 68, 'Tree 3: e-Edu 5M', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))
d_step1.add(Rect(435, 42, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step1.add(String(490, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step1.add(Line(490, 42, 490, 30, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
d_step1.add(Rect(435, 12, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#fed7aa'), strokeColor=None))
d_step1.add(String(490, 17, 'Slot 1: 9999999991 (Node #10)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))

# Info text
d_step1.add(String(65, 45, 'Commission: ₹565.00', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#15803d')))
d_step1.add(String(65, 30, '• Direct: ₹150+₹100+₹125', fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#334155')))
d_step1.add(String(65, 18, '• L1 Match: ₹125 | AP: ₹40', fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#334155')))

elements.append(d_step1)
elements.append(Spacer(1, 3))

# STEP 2 DIAGRAM
d_step2 = Drawing(564, 90)
d_step2.add(Rect(0, 0, 564, 90, rx=4, ry=4, fillColor=colors.HexColor('#f0fdf4'), strokeColor=colors.HexColor('#bbf7d0'), strokeWidth=1))
d_step2.add(Rect(5, 65, 120, 20, rx=3, ry=3, fillColor=colors.HexColor('#16a34a'), strokeColor=None))
d_step2.add(String(65, 71, 'STEP 2: User 9999999992 Joins', fontName='Helvetica-Bold', fontSize=7, textAnchor='middle', fillColor=colors.white))

# Tree 1 Box
d_step2.add(Rect(135, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#0284c7'), strokeWidth=0.8))
d_step2.add(String(202, 68, 'Tree 1: 5-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step2.add(Rect(145, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step2.add(String(202, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step2.add(Line(202, 42, 202, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step2.add(Rect(145, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#bae6fd'), strokeColor=None))
d_step2.add(String(202, 17, 'Pos 2: 9999999992 (Seat #119)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))

# Tree 2 Box
d_step2.add(Rect(280, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#7c3aed'), strokeWidth=0.8))
d_step2.add(String(347, 68, 'Tree 2: 3-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
d_step2.add(Rect(290, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step2.add(String(347, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step2.add(Line(347, 42, 347, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step2.add(Rect(290, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#ede9fe'), strokeColor=None))
d_step2.add(String(347, 17, 'Pos 2: 9999999992 (Seat #120)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))

# Tree 3 Box
d_step2.add(Rect(425, 10, 130, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#ea580c'), strokeWidth=0.8))
d_step2.add(String(490, 68, 'Tree 3: e-Edu 5M', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))
d_step2.add(Rect(435, 42, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step2.add(String(490, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step2.add(Line(490, 42, 490, 30, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
d_step2.add(Rect(435, 12, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#fed7aa'), strokeColor=None))
d_step2.add(String(490, 17, 'Slot 2: 9999999992 (Node #11)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))

# Info text
d_step2.add(String(65, 45, 'Commission: ₹380.00', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#15803d')))
d_step2.add(String(65, 30, '• Cumulative: ₹945.00', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step2.add(String(65, 18, '• Main Wallet: ₹945.00', fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#334155')))

elements.append(d_step2)
elements.append(Spacer(1, 3))

# STEP 3 DIAGRAM
d_step3 = Drawing(564, 90)
d_step3.add(Rect(0, 0, 564, 90, rx=4, ry=4, fillColor=colors.HexColor('#faf5ff'), strokeColor=colors.HexColor('#e9d5ff'), strokeWidth=1))
d_step3.add(Rect(5, 65, 120, 20, rx=3, ry=3, fillColor=colors.HexColor('#7c3aed'), strokeColor=None))
d_step3.add(String(65, 71, 'STEP 3: User 9999999993 Joins', fontName='Helvetica-Bold', fontSize=7, textAnchor='middle', fillColor=colors.white))

# Tree 1 Box
d_step3.add(Rect(135, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#0284c7'), strokeWidth=0.8))
d_step3.add(String(202, 68, 'Tree 1: 5-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step3.add(Rect(145, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step3.add(String(202, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step3.add(Line(202, 42, 202, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step3.add(Rect(145, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#bae6fd'), strokeColor=None))
d_step3.add(String(202, 17, 'Pos 3: 9999999993 (Seat #123)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))

# Tree 2 Box (L1 Full!)
d_step3.add(Rect(280, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#7c3aed'), strokeWidth=0.8))
d_step3.add(String(347, 68, 'Tree 2: 3-Matrix (L1 FULL!)', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
d_step3.add(Rect(290, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step3.add(String(347, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step3.add(Line(347, 42, 347, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step3.add(Rect(290, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#dcfce7'), strokeColor=None))
d_step3.add(String(347, 17, 'Pos 3: 9999999993 (Seat #124)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#166534')))

# Tree 3 Box
d_step3.add(Rect(425, 10, 130, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#ea580c'), strokeWidth=0.8))
d_step3.add(String(490, 68, 'Tree 3: e-Edu 5M', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))
d_step3.add(Rect(435, 42, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step3.add(String(490, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step3.add(Line(490, 42, 490, 30, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
d_step3.add(Rect(435, 12, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#fed7aa'), strokeColor=None))
d_step3.add(String(490, 17, 'Slot 3: 9999999993 (Node #12)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))

# Info text
d_step3.add(String(65, 45, 'Commission: ₹565.00', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#15803d')))
d_step3.add(String(65, 30, '• Cumulative: ₹1,510.00', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step3.add(String(65, 18, '• Tree 2 L1 Completed!', fontName='Helvetica-Bold', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#7c3aed')))

elements.append(d_step3)

# =========================================================================
# PAGE 3: STEP-BY-STEP EVOLUTION (STEPS 4 & 5 + REBIRTH TRIGGER)
# =========================================================================
elements.append(PageBreak())
elements.append(Paragraph('STEP-BY-STEP TREE EVOLUTION: STEPS 4 & 5 (REBIRTH FLYWHEEL)', t_main))
elements.append(Paragraph('Level 1 Completion of 5-Matrix & Automatic Self-Rebirth Triggers', t_sub))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1e1b4b'), spaceBefore=3, spaceAfter=4))

# STEP 4 DIAGRAM
d_step4 = Drawing(564, 90)
d_step4.add(Rect(0, 0, 564, 90, rx=4, ry=4, fillColor=colors.HexColor('#fffbeb'), strokeColor=colors.HexColor('#fde68a'), strokeWidth=1))
d_step4.add(Rect(5, 65, 120, 20, rx=3, ry=3, fillColor=colors.HexColor('#d97706'), strokeColor=None))
d_step4.add(String(65, 71, 'STEP 4: User 9999999994 Joins', fontName='Helvetica-Bold', fontSize=7, textAnchor='middle', fillColor=colors.white))

# Tree 1 Box
d_step4.add(Rect(135, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#0284c7'), strokeWidth=0.8))
d_step4.add(String(202, 68, 'Tree 1: 5-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step4.add(Rect(145, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step4.add(String(202, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step4.add(Line(202, 42, 202, 30, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step4.add(Rect(145, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#bae6fd'), strokeColor=None))
d_step4.add(String(202, 17, 'Pos 4: 9999999994 (Seat #127)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))

# Tree 2 Box (L2 Spillover!)
d_step4.add(Rect(280, 10, 135, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#7c3aed'), strokeWidth=0.8))
d_step4.add(String(347, 68, 'Tree 2: 3-Matrix (L2 Spill!)', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
d_step4.add(Rect(290, 42, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step4.add(String(347, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step4.add(Line(347, 42, 347, 30, strokeColor=colors.HexColor('#7c3aed'), strokeWidth=1))
d_step4.add(Rect(290, 12, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#fef3c7'), strokeColor=None))
d_step4.add(String(347, 17, 'L2 (under U1): Seat #128', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#92400e')))

# Tree 3 Box
d_step4.add(Rect(425, 10, 130, 70, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#ea580c'), strokeWidth=0.8))
d_step4.add(String(490, 68, 'Tree 3: e-Edu 5M', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))
d_step4.add(Rect(435, 42, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step4.add(String(490, 47, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step4.add(Line(490, 42, 490, 30, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
d_step4.add(Rect(435, 12, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#fed7aa'), strokeColor=None))
d_step4.add(String(490, 17, 'Slot 4: 9999999994 (Node #13)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))

# Info text
d_step4.add(String(65, 45, 'Commission: ₹380.00', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#15803d')))
d_step4.add(String(65, 30, '• Cumulative: ₹1,890.00', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step4.add(String(65, 18, '• 3M Spilled under 9999999991', fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#334155')))

elements.append(d_step4)
elements.append(Spacer(1, 3))

# STEP 5 DIAGRAM (ALL 5 COMPLETE + REBIRTH)
d_step5 = Drawing(564, 110)
d_step5.add(Rect(0, 0, 564, 110, rx=4, ry=4, fillColor=colors.HexColor('#f0fdf4'), strokeColor=colors.HexColor('#86efac'), strokeWidth=1))
d_step5.add(Rect(5, 80, 120, 22, rx=3, ry=3, fillColor=colors.HexColor('#15803d'), strokeColor=None))
d_step5.add(String(65, 88, 'STEP 5: User 9999999995 Joins', fontName='Helvetica-Bold', fontSize=7, textAnchor='middle', fillColor=colors.white))
d_step5.add(String(65, 82, '(5/5 DIRECTS COMPLETE!)', fontName='Helvetica-Bold', fontSize=5, textAnchor='middle', fillColor=colors.HexColor('#fef08a')))

# Tree 1 Box (L1 Full!)
d_step5.add(Rect(135, 10, 135, 90, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#0284c7'), strokeWidth=0.8))
d_step5.add(String(202, 88, 'Tree 1: 5-Matrix (L1 FULL!)', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
d_step5.add(Rect(145, 62, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step5.add(String(202, 67, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step5.add(Line(202, 62, 202, 48, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step5.add(Rect(145, 12, 115, 34, rx=2, ry=2, fillColor=colors.HexColor('#dcfce7'), strokeColor=None))
d_step5.add(String(202, 34, 'Pos 1-5: All 5 Directs Filled', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#15803d')))
d_step5.add(String(202, 22, 'Next direct spills to Level 2!', fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#166534')))

# Tree 2 Box
d_step5.add(Rect(280, 10, 135, 90, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#7c3aed'), strokeWidth=0.8))
d_step5.add(String(347, 88, 'Tree 2: 3-Matrix', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
d_step5.add(Rect(290, 62, 115, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step5.add(String(347, 67, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step5.add(Line(347, 62, 347, 48, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_step5.add(Rect(290, 12, 115, 34, rx=2, ry=2, fillColor=colors.HexColor('#ede9fe'), strokeColor=None))
d_step5.add(String(347, 34, 'L1 (3) + L2 (2 Spilled)', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
d_step5.add(String(347, 22, 'Spillover passive income active', fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#581c87')))

# Tree 3 Box (L1 Full!)
d_step5.add(Rect(425, 10, 130, 90, rx=3, ry=3, fillColor=colors.white, strokeColor=colors.HexColor('#ea580c'), strokeWidth=0.8))
d_step5.add(String(490, 88, 'Tree 3: e-Edu (L1 FULL!)', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))
d_step5.add(Rect(435, 62, 110, 18, rx=2, ry=2, fillColor=colors.HexColor('#1e1b4b'), strokeColor=None))
d_step5.add(String(490, 67, 'Root: 9999999999', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.white))
d_step5.add(Line(490, 62, 490, 48, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
d_step5.add(Rect(435, 12, 110, 34, rx=2, ry=2, fillColor=colors.HexColor('#fed7aa'), strokeColor=None))
d_step5.add(String(490, 34, 'All 5 Direct Slots Filled', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#9a3412')))
d_step5.add(String(490, 22, 'Full 7-Day Qualifier Achieved!', fontName='Helvetica-Bold', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#15803d')))

# Info text
d_step5.add(String(65, 58, 'Commission: ₹565.00', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#15803d')))
d_step5.add(String(65, 42, 'FINAL BALANCE:', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.HexColor('#0f172a')))
d_step5.add(String(65, 28, '₹2,455.00', fontName='Helvetica-Bold', fontSize=10, textAnchor='middle', fillColor=colors.HexColor('#047857')))
d_step5.add(String(65, 16, '2 Auto-Rebirths Triggered!', fontName='Helvetica-Bold', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#b45309')))

elements.append(d_step5)

# =========================================================================
# PAGE 4: INDIVIDUAL TREE 1 (5-MATRIX) & TREE 2 (3-MATRIX)
# =========================================================================
elements.append(PageBreak())
elements.append(Paragraph('INDIVIDUAL TREE 1 (5-MATRIX) & TREE 2 (3-MATRIX)', t_main))
elements.append(Paragraph('Detailed Genealogical Placements for 9999999991 to 9999999995', t_sub))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#0284c7'), spaceBefore=3, spaceAfter=4))

# LARGE TREE 1 DIAGRAM
elements.append(Paragraph('Tree 1: Join Prime 5-Matrix ($5 \\times N$ Forced BFS Spillover)', h1))
d_tree1 = Drawing(564, 130)
d_tree1.add(Rect(0, 0, 564, 130, rx=4, ry=4, fillColor=colors.HexColor('#f0f9ff'), strokeColor=colors.HexColor('#bae6fd'), strokeWidth=1))

# Root node
d_tree1.add(Rect(222, 85, 120, 35, rx=3, ry=3, fillColor=colors.HexColor('#1e1b4b'), strokeColor=colors.HexColor('#0f172a'), strokeWidth=1.2))
d_tree1.add(String(282, 106, '👑 ROOT (9999999999)', fontName='Helvetica-Bold', fontSize=7.5, textAnchor='middle', fillColor=colors.white))
d_tree1.add(String(282, 94, '5-Matrix Primary Root', fontName='Helvetica', fontSize=6, textAnchor='middle', fillColor=colors.HexColor('#93c5fd')))

# Bus line
d_tree1.add(Line(282, 85, 282, 68, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_tree1.add(Line(55, 68, 505, 68, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))

# 5 Children
l1_x = [55, 168, 282, 395, 505]
l1_users = [('9999999991', 'Seat #115'), ('9999999992', 'Seat #119'), ('9999999993', 'Seat #123'), ('9999999994', 'Seat #127'), ('9999999995', 'Seat #131')]
for i, cx in enumerate(l1_x):
    d_tree1.add(Line(cx, 68, cx, 52, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
    d_tree1.add(Rect(cx - 45, 10, 90, 42, rx=3, ry=3, fillColor=colors.HexColor('#e0f2fe'), strokeColor=colors.HexColor('#0284c7'), strokeWidth=1))
    d_tree1.add(String(cx, 39, f'Slot {i+1}: {l1_users[i][0]}', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#0369a1')))
    d_tree1.add(String(cx, 27, l1_users[i][1], fontName='Helvetica', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#334155')))
    d_tree1.add(String(cx, 16, '₹30.00 to Root', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#15803d')))

elements.append(d_tree1)
elements.append(Spacer(1, 4))

# LARGE TREE 2 DIAGRAM
elements.append(Paragraph('Tree 2: Join Prime 3-Matrix ($3 \\times N$ Forced Fast-Filling Tree)', h1))
d_tree2 = Drawing(564, 140)
d_tree2.add(Rect(0, 0, 564, 140, rx=4, ry=4, fillColor=colors.HexColor('#faf5ff'), strokeColor=colors.HexColor('#e9d5ff'), strokeWidth=1))

# Root node
d_tree2.add(Rect(222, 95, 120, 35, rx=3, ry=3, fillColor=colors.HexColor('#1e1b4b'), strokeColor=colors.HexColor('#0f172a'), strokeWidth=1.2))
d_tree2.add(String(282, 116, '👑 ROOT (9999999999)', fontName='Helvetica-Bold', fontSize=7.5, textAnchor='middle', fillColor=colors.white))
d_tree2.add(String(282, 104, '3-Matrix Primary Root', fontName='Helvetica', fontSize=6, textAnchor='middle', fillColor=colors.HexColor('#d8b4fe')))

# Bus line to Level 1
d_tree2.add(Line(282, 95, 282, 80, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
d_tree2.add(Line(110, 80, 450, 80, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))

# 3 Children (Level 1)
l1_3_x = [110, 280, 450]
l1_3_users = [('9999999991', 'Seat #116 (Pos 1)'), ('9999999992', 'Seat #120 (Pos 2)'), ('9999999993', 'Seat #124 (Pos 3)')]
for i, cx in enumerate(l1_3_x):
    d_tree2.add(Line(cx, 80, cx, 66, strokeColor=colors.HexColor('#64748b'), strokeWidth=1))
    d_tree2.add(Rect(cx - 50, 42, 100, 24, rx=3, ry=3, fillColor=colors.HexColor('#ede9fe'), strokeColor=colors.HexColor('#7c3aed'), strokeWidth=1))
    d_tree2.add(String(cx, 55, l1_3_users[i][0], fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#6b21a8')))
    d_tree2.add(String(cx, 45, l1_3_users[i][1], fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#334155')))

# Level 2 Spillover Branch under 9999999991
d_tree2.add(Line(110, 42, 110, 28, strokeColor=colors.HexColor('#d97706'), strokeWidth=1, strokeDashArray=[2,2]))
d_tree2.add(Line(70, 28, 150, 28, strokeColor=colors.HexColor('#d97706'), strokeWidth=1, strokeDashArray=[2,2]))

# Spilled Node 1 (9999999994)
d_tree2.add(Line(70, 28, 70, 22, strokeColor=colors.HexColor('#d97706'), strokeWidth=1))
d_tree2.add(Rect(30, 4, 80, 18, rx=2, ry=2, fillColor=colors.HexColor('#fef3c7'), strokeColor=colors.HexColor('#d97706'), strokeWidth=0.8))
d_tree2.add(String(70, 10, '9999999994 (Seat #128)', fontName='Helvetica-Bold', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#92400e')))

# Spilled Node 2 (9999999995)
d_tree2.add(Line(150, 28, 150, 22, strokeColor=colors.HexColor('#d97706'), strokeWidth=1))
d_tree2.add(Rect(110, 4, 80, 18, rx=2, ry=2, fillColor=colors.HexColor('#fef3c7'), strokeColor=colors.HexColor('#d97706'), strokeWidth=0.8))
d_tree2.add(String(150, 10, '9999999995 (Seat #132)', fontName='Helvetica-Bold', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#92400e')))

# Open slots indicator
d_tree2.add(Rect(220, 4, 320, 18, rx=2, ry=2, fillColor=colors.HexColor('#f1f5f9'), strokeColor=colors.HexColor('#94a3b8'), strokeWidth=0.8, strokeDashArray=[3,3]))
d_tree2.add(String(380, 10, 'Remaining L2 Slots (under 9999999992 & 9999999993) - Open for Rebirths/New Directs', fontName='Helvetica-Oblique', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#64748b')))

elements.append(d_tree2)

# =========================================================================
# PAGE 5: INDIVIDUAL TREE 3 (e-Edu 5-MATRIX) & OVERFLOW ARCHITECTURE
# =========================================================================
elements.append(PageBreak())
elements.append(Paragraph('INDIVIDUAL TREE 3 (DIGITAL EDUCATION 5-MATRIX)', t_main))
elements.append(Paragraph('Dedicated 5x10 Rank Tree for Directs & Overhead Overflow Box Routing', t_sub))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#ea580c'), spaceBefore=3, spaceAfter=4))

d_tree3 = Drawing(564, 180)
d_tree3.add(Rect(0, 0, 564, 180, rx=4, ry=4, fillColor=colors.HexColor('#fff7ed'), strokeColor=colors.HexColor('#fed7aa'), strokeWidth=1))

# Root node
d_tree3.add(Rect(40, 125, 170, 42, rx=4, ry=4, fillColor=colors.HexColor('#1e1b4b'), strokeColor=colors.HexColor('#0f172a'), strokeWidth=1.2))
d_tree3.add(String(125, 153, '👑 ROOT (9999999999)', fontName='Helvetica-Bold', fontSize=8, textAnchor='middle', fillColor=colors.white))
d_tree3.add(String(125, 141, 'e-Edu 5-Matrix Rank Root', fontName='Helvetica', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#fdba74')))
d_tree3.add(String(125, 131, 'Directs: 5/5 Qualified (100%)', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.HexColor('#4ade80')))

# Company Overflow Box (Top Right)
d_tree3.add(Rect(310, 125, 220, 42, rx=4, ry=4, fillColor=colors.HexColor('#dc2626'), strokeColor=colors.HexColor('#991b1b'), strokeWidth=1.2))
d_tree3.add(String(420, 153, '📦 OVERHEAD OVERFLOW BOX', fontName='Helvetica-Bold', fontSize=8, textAnchor='middle', fillColor=colors.white))
d_tree3.add(String(420, 141, 'Company Account: User ID 1 (admin)', fontName='Helvetica', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#fecaca')))
d_tree3.add(String(420, 131, 'Captures All L2-L10 Unclaimed Matches', fontName='Helvetica-Bold', fontSize=6, textAnchor='middle', fillColor=colors.HexColor('#fef08a')))

# Bus line down to 5 Direct Slots
d_tree3.add(Line(125, 125, 125, 105, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1.2))
d_tree3.add(Line(50, 105, 510, 105, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1.2))

# 5 Direct Nodes (All 5 Slots Filled!)
edu_x = [50, 165, 280, 395, 510]
edu_nodes = [
    ('9999999991', 'Node #10', 'Pos 1 (Depth 1)'),
    ('9999999992', 'Node #11', 'Pos 2 (Depth 1)'),
    ('9999999993', 'Node #12', 'Pos 3 (Depth 1)'),
    ('9999999994', 'Node #13', 'Pos 4 (Depth 1)'),
    ('9999999995', 'Node #14', 'Pos 5 (Depth 1)'),
]
for i, cx in enumerate(edu_x):
    d_tree3.add(Line(cx, 105, cx, 88, strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
    d_tree3.add(Rect(cx - 48, 20, 96, 68, rx=3, ry=3, fillColor=colors.HexColor('#ffedd5'), strokeColor=colors.HexColor('#ea580c'), strokeWidth=1))
    d_tree3.add(String(cx, 75, f'SLOT {i+1}', fontName='Helvetica-Bold', fontSize=6.5, textAnchor='middle', fillColor=colors.HexColor('#c2410c')))
    d_tree3.add(String(cx, 62, edu_nodes[i][0], fontName='Helvetica-Bold', fontSize=7, textAnchor='middle', fillColor=colors.HexColor('#0f172a')))
    d_tree3.add(String(cx, 50, edu_nodes[i][1], fontName='Helvetica', fontSize=6, textAnchor='middle', fillColor=colors.HexColor('#475569')))
    d_tree3.add(String(cx, 38, edu_nodes[i][2], fontName='Helvetica', fontSize=5.5, textAnchor='middle', fillColor=colors.HexColor('#64748b')))
    d_tree3.add(String(cx, 26, '₹125 Dir + ₹125 L1', fontName='Helvetica-Bold', fontSize=5.8, textAnchor='middle', fillColor=colors.HexColor('#15803d')))

elements.append(d_tree3)
elements.append(Spacer(1, 4))

elements.append(Paragraph('Digital Education Rank Commission Logic & Overflow Proof', h1))
elements.append(Paragraph(
    '• <b>Rank 1 Base Purchase (₹250.00):</b> 50% (₹125) goes to Direct Sponsor (Root 9999999999) + 50% (₹125) goes to 1st Parent User (Root 9999999999) = <b>₹250.00 per direct</b>.<br/>'
    '• <b>When Directs Upgrade to Layer 2 to Layer 10:</b> 50% Direct Sponsor Bonus goes to Root (9999999999), and the 50% Layer Matching Bonus (since Root has no uplines) '
    '<b>automatically routes to the Overhead Overflow Box (User ID 1: admin)</b> without leaking into the user wallet.',
    body
))

# =========================================================================
# PAGE 6: MASTER RECONCILIATION & WALLET LIFECYCLE
# =========================================================================
elements.append(PageBreak())
elements.append(Paragraph('FINAL FINANCIAL AUDIT & GRAND MASTER RECONCILIATION', t_main))
elements.append(Paragraph('Complete Mathematical Reconciliation of the 5 Direct Members Inflow (₹10,000 Total)', t_sub))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1e1b4b'), spaceBefore=3, spaceAfter=4))

elements.append(Paragraph('1. Progressive Wallet & Rebirth Trace Table (Transaction by Transaction)', h1))
recon_table = [
    [Paragraph('Step / Event', th), Paragraph('Package / Action', th), Paragraph('Gross Inflow', th), Paragraph('75% Main Wallet', th), Paragraph('25% Self Pocket', th), Paragraph('Rebirth Triggered', th), Paragraph('Ending Balance', th)],
    [Paragraph('<b>Step 1</b>', td_c), Paragraph('User 9999999991 (₹2k Combo)', td), Paragraph('₹2,000.00', td_r), Paragraph('+₹423.75', td_r), Paragraph('+₹141.25', td_r), Paragraph('None (Pocket < ₹250)', td_c), Paragraph('<b>₹565.00</b>', td_r)],
    [Paragraph('<b>Step 2</b>', td_c), Paragraph('User 9999999992 (₹2k Combo)', td), Paragraph('₹2,000.00', td_r), Paragraph('+₹285.00', td_r), Paragraph('+₹95.00', td_r), Paragraph('None (Pocket = ₹236.25)', td_c), Paragraph('<b>₹945.00</b>', td_r)],
    [Paragraph('<b>Step 3</b>', td_c), Paragraph('User 9999999993 (₹2k Combo)', td), Paragraph('₹2,000.00', td_r), Paragraph('+₹423.75', td_r), Paragraph('+₹141.25', td_r), Paragraph('<b>Rebirth #1 (₹250)</b>', td_bc), Paragraph('<b>₹1,510.00</b>', td_r)],
    [Paragraph('<b>Step 4</b>', td_c), Paragraph('User 9999999994 (₹2k Combo)', td), Paragraph('₹2,000.00', td_r), Paragraph('+₹285.00', td_r), Paragraph('+₹95.00', td_r), Paragraph('None (Pocket = ₹222.50)', td_c), Paragraph('<b>₹1,890.00</b>', td_r)],
    [Paragraph('<b>Step 5</b>', td_c), Paragraph('User 9999999995 (₹2k Combo)', td), Paragraph('₹2,000.00', td_r), Paragraph('+₹423.75', td_r), Paragraph('+₹141.25', td_r), Paragraph('<b>Rebirth #2 (₹250)</b>', td_bc), Paragraph('<b>₹2,455.00</b>', td_r)],
    [Paragraph('<b>TOTALS</b>', td_bc), Paragraph('<b>5 Users × ₹2,000</b>', td_b), Paragraph('<b>₹10,000.00</b>', td_bc), Paragraph('<b>₹1,841.25</b>', td_bc), Paragraph('<b>₹613.75</b>', td_bc), Paragraph('<b>2 Rebirth IDs Fired</b>', td_bc), Paragraph('<b>₹2,455.00 Net</b>', td_bc)],
]
t_r = Table(recon_table, colWidths=[50, 135, 75, 75, 75, 80, 74])
t_r.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e1b4b')),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#f8fafc')]),
    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#dcfce7')),
    ('TOPPADDING', (0,0), (-1,-1), 2.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
]))
elements.append(t_r)
elements.append(Spacer(1, 4))

elements.append(Paragraph('2. Grand Master Balance Sheet (₹10,000.00 Total Inflow)', h1))
balance_sheet = [
    [Paragraph('Line Item / Beneficiary', th), Paragraph('Income Lineage / Allocation Purpose', th), Paragraph('Amount (INR)', th), Paragraph('Share % / Status', th)],
    [Paragraph('<b>👑 Root Sponsor (9999999999)</b>', td_b), Paragraph('• Direct Referrals (Prime + SPP + Edu L1)<br/>• Layer 1 Matching Bonus (5 Directs × ₹125)<br/>• Autopool 5M & 3M Bonuses + Rebirth Cycles', td), Paragraph('₹2,455.00', td_r), Paragraph('<b>24.55%</b><br/>(Withdrawable Cash)', td)],
    [Paragraph('<b>🛍️ SPP Product Voucher & Pools</b>', td_b), Paragraph('5 × ₹1,000 SPP Monthly Volume dedicated to Product Vouchers and 11:59 PM Daily Pools', td), Paragraph('₹5,000.00', td_r), Paragraph('<b>50.00%</b><br/>(Product / Pools)', td)],
    [Paragraph('<b>👥 Autopool Upline Reserves</b>', td_b), Paragraph('Join Prime 5-Matrix & 3-Matrix multi-level autopool allocations held for upper lineage', td), Paragraph('₹1,500.00', td_r), Paragraph('<b>15.00%</b><br/>(Autopool Multi-Tier)', td)],
    [Paragraph('<b>📦 Overhead Overflow Box</b>', td_b), Paragraph('Company reserve holding unallocated upper-layer matches and system platform share', td), Paragraph('₹750.00', td_r), Paragraph('<b>7.50%</b><br/>(Overhead Reserve)', td)],
    [Paragraph('<b>⚙️ Platform Operations & Tax</b>', td_b), Paragraph('GST pool, franchise share, and infrastructure buffer', td), Paragraph('₹295.00', td_r), Paragraph('<b>2.95%</b><br/>(Operations)', td)],
    [Paragraph('<b>GRAND TOTAL BALANCED</b>', td_bc), Paragraph('<b>Sum of all Distributed Commissions + Retained Reserves</b>', td_b), Paragraph('<b>₹10,000.00</b>', td_bc), Paragraph('<b>100% ZERO LEAKAGE</b>', td_bc)],
]
t_bs = Table(balance_sheet, colWidths=[120, 200, 105, 139])
t_bs.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e1b4b')),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#f8fafc')]),
    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#dcfce7')),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
]))
elements.append(t_bs)

doc.build(elements)
print(f"SUCCESS: 6-Page Master PDF generated at: {pdf_path}")
