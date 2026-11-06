"""Build the reviewed channel report from its editable Markdown source."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT/'fitlore-channel-report-2026-11-02.md'
DESTINATION = ROOT/'output'/'pdf'/'FitLore-Channel-Report-2026-11-02.pdf'
DESTINATION.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFont(TTFont('ArialItalic', r'C:\Windows\Fonts\ariali.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold',italic='ArialItalic',boldItalic='ArialBold')
RED=colors.HexColor('#BD232B'); INK=colors.HexColor('#17202B'); MUTED=colors.HexColor('#586374')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='ReportTitle',fontName='ArialBold',fontSize=23,leading=27,textColor=INK,spaceAfter=12))
styles.add(ParagraphStyle(name='SectionTitle',fontName='ArialBold',fontSize=17,leading=21,textColor=RED,spaceAfter=14,keepWithNext=True))
styles.add(ParagraphStyle(name='Subhead',fontName='ArialBold',fontSize=11.4,leading=15,textColor=INK,spaceBefore=8,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='ReportBody',fontName='Arial',fontSize=10,leading=14,textColor=INK,spaceAfter=9,splitLongWords=True,allowWidows=0,allowOrphans=0))
styles.add(ParagraphStyle(name='Meta',parent=styles['ReportBody'],fontSize=9,leading=12,textColor=MUTED,spaceAfter=7))
styles.add(ParagraphStyle(name='QuoteBody',parent=styles['ReportBody'],leftIndent=14,rightIndent=12,borderColor=RED,borderWidth=0,borderPadding=8,backColor=colors.HexColor('#FAF1F1'),spaceBefore=3,spaceAfter=6))
styles.add(ParagraphStyle(name='Cell',fontName='Arial',fontSize=8.4,leading=11,textColor=INK,spaceAfter=0,splitLongWords=True))
styles.add(ParagraphStyle(name='CellHeader',parent=styles['Cell'],fontName='ArialBold',textColor=colors.white))
styles.add(ParagraphStyle(name='BulletBody',parent=styles['ReportBody'],leftIndent=10,firstLineIndent=-8,spaceAfter=6))

def inline(text):
    text=escape(text)
    text=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',lambda m:f'<link href="{m[2]}" color="#125A88">{m[1]}</link>',text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',text)
    text=re.sub(r'`([^`]+)`',r'<font size="9">\1</font>',text)
    return text

def decorate(pdf,doc):
    w,h=A4
    pdf.saveState()
    pdf.setStrokeColor(RED); pdf.setLineWidth(2); pdf.line(48,h-34,w-48,h-34)
    pdf.setFont('ArialBold',8); pdf.setFillColor(INK); pdf.drawString(48,h-24,'FITLORE / CHANNEL IDENTITY REPORT')
    pdf.setFont('Arial',8); pdf.setFillColor(MUTED); pdf.drawRightString(w-48,h-24,'2 NOVEMBER 2026')
    pdf.setStrokeColor(colors.HexColor('#D8DDE3')); pdf.setLineWidth(.5); pdf.line(48,37,w-48,37)
    pdf.setFont('Arial',8); pdf.drawString(48,24,'Prepared by He-MAN | Public channel review + local production evidence')
    pdf.drawRightString(w-48,24,f'{doc.page}')
    pdf.restoreState()

doc=SimpleDocTemplate(str(DESTINATION),pagesize=A4,leftMargin=48,rightMargin=48,topMargin=52,bottomMargin=50,
    title='FitLore: Channel Identity and Content Report',author='He-MAN',subject='Channel identity, public content, audience hypotheses and editorial direction')
lines=SOURCE.read_text(encoding='utf-8').splitlines(); flow=[]; i=0; first_section=True
while i<len(lines):
    line=lines[i].strip()
    if not line: i+=1; continue
    if line.startswith('# '):
        flow.append(Paragraph(inline(line[2:]),styles['ReportTitle'])); i+=1; continue
    if line.startswith('## '):
        if not first_section: flow.append(PageBreak())
        first_section=False
        flow.append(Paragraph(inline(line[3:]),styles['SectionTitle'])); i+=1; continue
    if line.startswith('### '):
        flow.append(Paragraph(inline(line[4:]),styles['Subhead'])); i+=1; continue
    if line.startswith('|'):
        raw=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[:\- ]+',c) for c in cells): raw.append(cells)
            i+=1
        n=len(raw[0]); available=A4[0]-96
        if n==4: widths=[30,238,80,available-348]
        elif n==3: widths=[available*.27,available*.34,available*.39]
        else: widths=[available*.33,available*.67]
        rows=[[Paragraph(inline(c),styles['CellHeader'] if r==0 else styles['Cell']) for c in cells] for r,cells in enumerate(raw)]
        table=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),INK),('VALIGN',(0,0),(-1,-1),'TOP'),
            ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
            ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F0F3F6'),colors.white]),
            ('LINEBELOW',(0,0),(-1,0),1,RED),('LINEBELOW',(0,1),(-1,-1),.35,colors.HexColor('#D8DDE3'))]))
        flow.extend([table,Spacer(1,12)]); continue
    if line.startswith('>'):
        flow.append(Paragraph(inline(line[1:].strip()),styles['QuoteBody'])); i+=1; continue
    if line.startswith('- '):
        flow.append(Paragraph('&#8226; '+inline(line[2:]),styles['BulletBody'])); i+=1; continue
    parts=[line]; i+=1
    while i<len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(('#','|','>','- ')):
        parts.append(lines[i].strip()); i+=1
    text=' '.join(parts)
    style=styles['Meta'] if text.startswith(('Prepared by','Channel:')) else styles['ReportBody']
    flow.append(Paragraph(inline(text),style))
doc.build(flow,onFirstPage=decorate,onLaterPages=decorate)
print(str(DESTINATION))
