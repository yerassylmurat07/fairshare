"""Offline HTML and Unicode PDF export. Requires reportlab; the app does not."""
from pathlib import Path
import html
import re
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle, PageBreak, Image

ROOT=Path(__file__).parents[1]
FILES=[('architecture','Архитектура',ROOT/'docs/architecture.md'),('features','Функции группы',ROOT/'docs/features.md'),('allocation','Алгоритм распределения',ROOT/'docs/allocation.md'),('data-and-security','Данные и права',ROOT/'docs/data-and-security.md'),('roadmap','Развитие и гипотезы',ROOT/'docs/roadmap.md'),('sources','Источники',ROOT/'docs/sources.md'),('design-system','Визуальная спецификация',ROOT/'docs/design-system.md')]

def inline(text):
    text=html.escape(text)
    text=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1',text)
    text=re.sub(r'`([^`]+)`',r'<font color="#6145be">\1</font>',text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',text)
    return text

fontdir=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('FS','DejaVuSans.ttf'),('FS-Bold','DejaVuSans-Bold.ttf'),('FS-Oblique','DejaVuSans-Oblique.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(fontdir/file)))
pdfmetrics.registerFontFamily('FS',normal='FS',bold='FS-Bold',italic='FS-Oblique',boldItalic='FS-Bold')
styles=getSampleStyleSheet()
for s in styles.byName.values():s.fontName='FS'
styles.add(ParagraphStyle(name='FSBody',fontName='FS',fontSize=9.3,leading=15,spaceAfter=8,textColor=colors.HexColor('#34394b')))
styles.add(ParagraphStyle(name='FSCell',parent=styles['FSBody'],fontSize=7.6,leading=11,spaceAfter=0))
styles.add(ParagraphStyle(name='FSCode',fontName='FS',fontSize=7.0,leading=10,textColor=colors.HexColor('#655776'),backColor=colors.HexColor('#f4f2fa'),borderPadding=10,spaceAfter=10))
for name,size in [('Heading1',23),('Heading2',15),('Heading3',11.5)]:
    styles[name].fontName='FS-Bold';styles[name].fontSize=size;styles[name].leading=size*1.35;styles[name].textColor=colors.HexColor('#292039');styles[name].spaceBefore=16;styles[name].spaceAfter=10

WIDTH=A4[0]-94
story=[]
story += [Spacer(1,65),Paragraph('FairShare',ParagraphStyle(name='Cover',fontName='FS-Bold',fontSize=44,leading=55,textColor=colors.HexColor('#7056e8'))),Spacer(1,16),Paragraph('Архитектура и рабочий MVP',styles['Heading1']),Paragraph('Студенческая командная работа: понятные задачи, посильная нагрузка, видимые препятствия.',styles['FSBody']),Spacer(1,20),Paragraph('Проект по M1 Product Vision · 2 октября 2026',styles['FSBody']),Spacer(1,26)]
for index,(_,title,_) in enumerate(FILES,1):story.append(Paragraph(f'{index:02d}   {title}',styles['FSBody']))
story+=[Spacer(1,26),Paragraph('Исходный код, API-контракт и SQL-схема входят в комплект. Реализованные возможности отделены от будущих; результаты пользовательского исследования не выдумываются.',styles['FSBody'])]

def blocks(text):
    lines=text.splitlines();i=0
    while i<len(lines):
        line=lines[i]
        if not line.strip():i+=1;continue
        if line.startswith('```'):
            language=line[3:];code=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):code.append(lines[i]);i+=1
            yield ('code',language,code);i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c) for c in cells):rows.append(cells)
                i+=1
            yield ('table',rows);continue
        if line.startswith('#'):
            level=len(line)-len(line.lstrip('#'));yield('heading',level,line[level:].strip());i+=1;continue
        if line.startswith('- ') or re.match(r'^\d+\. ',line):yield('list',line);i+=1;continue
        paragraph=[line];i+=1
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','```','- ')) and not re.match(r'^\d+\. ',lines[i]):paragraph.append(lines[i]);i+=1
        yield('paragraph',' '.join(paragraph))

htmlsections=[]
for section,title,path in FILES:
    story.append(PageBreak());htmlparts=[f'<section id="{section}">']
    for block in blocks(path.read_text()):
        kind=block[0]
        if kind=='heading':
            _,level,value=block;story.append(Paragraph(inline(value),styles['Heading'+str(min(level,3))]));htmlparts.append(f'<h{min(level+1,4)}>{html.escape(value)}</h{min(level+1,4)}>')
        elif kind=='paragraph':story.append(Paragraph(inline(block[1]),styles['FSBody']));htmlparts.append('<p>'+inline(block[1]).replace('<font color="#6145be">','<code>').replace('</font>','</code>')+'</p>')
        elif kind=='list':
            value=block[1];story.append(Paragraph(inline(value),styles['FSBody']));htmlparts.append('<p class="list-item">'+inline(value).replace('<font color="#6145be">','<code>').replace('</font>','</code>')+'</p>')
        elif kind=='table':
            rows=block[1];n=max(map(len,rows));table=Table([[Paragraph(inline(c),styles['FSCell']) for c in row]+['']*(n-len(row)) for row in rows],colWidths=[WIDTH/n]*n,repeatRows=1,hAlign=TA_LEFT)
            table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeebff')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8f9fc')]),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#e4e5ec'))]));story+=[table,Spacer(1,12)]
            htmlparts.append('<div class="table-scroll"><table>'+''.join('<tr>'+''.join(f'<{"th" if k==0 else "td"}>{inline(c)}</{"th" if k==0 else "td"}>' for c in row)+'</tr>' for k,row in enumerate(rows))+'</table></div>')
        elif kind=='code':
            _,language,lines=block
            if language=='mermaid':
                story.append(Paragraph('Схема в Mermaid; исходник доступен в соответствующем Markdown-документе.',styles['FSBody']))
                if section=='architecture' and any('Browser[' in l for l in lines):
                    png=ROOT/'diagrams/containers.png'
                    if png.exists():
                        im=Image(str(png));im.drawHeight=im.imageHeight/im.imageWidth*WIDTH;im.drawWidth=WIDTH;story+=[im,Spacer(1,12)]
                htmlparts.append('<details><summary>Исходник схемы Mermaid</summary><pre>'+html.escape('\n'.join(lines))+'</pre></details>')
            else:
                wrapped=[]
                for l in lines:
                    while len(l)>95:wrapped.append(l[:95]);l=l[95:]
                    wrapped.append(l)
                story.append(Preformatted('\n'.join(wrapped),styles['FSCode']));htmlparts.append('<pre>'+html.escape('\n'.join(lines))+'</pre>')
    htmlparts.append('</section>');htmlsections.append('\n'.join(htmlparts))

def footer(canvas,doc):
    canvas.setFont('FS',8);canvas.setFillColor(colors.HexColor('#9299aa'));canvas.drawString(47,27,'FairShare · архитектура / MVP');canvas.drawRightString(A4[0]-47,27,str(doc.page))
SimpleDocTemplate(str(ROOT/'FairShare-architecture.pdf'),pagesize=A4,rightMargin=47,leftMargin=47,topMargin=40,bottomMargin=46,title='FairShare: архитектура и MVP',author='FairShare').build(story,onFirstPage=footer,onLaterPages=footer)

toc=''.join(f'<a href="#{key}">{title}</a>' for key,title,_ in FILES)
svg=(ROOT/'diagrams/containers.svg').read_text();svg=svg[svg.find('<svg'):]
page=f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FairShare — архитектура и MVP</title><style>
*{{box-sizing:border-box}}body{{margin:0;font:16px/1.75 system-ui,sans-serif;color:#293044;background:#fafbfe}}nav{{position:fixed;inset:0 auto 0 0;width:250px;background:white;border-right:1px solid #e5e8f0;padding:32px 24px}}nav strong{{display:block;color:#7056e8;font-size:27px;letter-spacing:-1px;margin-bottom:25px}}nav a{{display:block;text-decoration:none;color:#626d85;font-size:14px;padding:9px 0}}main{{margin-left:250px;padding:50px 6vw;max-width:1250px}}h1{{font-size:42px;letter-spacing:-1.5px;line-height:1.2}}h2{{margin-top:0;font-size:29px}}h3{{font-size:22px;margin-top:32px}}h4{{font-size:18px}}section{{padding-top:35px;margin-top:45px;border-top:1px solid #e5e8f0;scroll-margin-top:25px}}p{{color:#5e6980}}table{{border-collapse:collapse;width:100%;font-size:13px}}th,td{{padding:12px;vertical-align:top;text-align:left;border-bottom:1px solid #e5e8f0}}th{{background:#eeebff;color:#594589}}.table-scroll,.diagram{{overflow:auto}}.diagram svg{{width:100%;min-width:650px;height:auto}}code{{color:#7056e8;font-size:.92em}}pre{{font:13px/1.7 monospace;padding:20px;background:#f0eef8;overflow:auto}}summary{{color:#7056e8;cursor:pointer;font-size:13px}}.intro{{font-size:19px;max-width:680px}}.list-item{{margin:8px 0}}@media(max-width:800px){{nav{{position:static;width:auto;border-right:0;border-bottom:1px solid #e5e8f0}}nav a{{display:inline-block;padding-right:15px}}main{{margin-left:0;padding:30px 22px}}h1{{font-size:33px}}}}@media print{{nav{{display:none}}main{{margin:0;padding:0}}section{{break-before:page}}}}
</style><nav><strong>FairShare</strong>{toc}</nav><main><h1>Архитектура<br>и рабочий MVP</h1><p class="intro">Понятные задачи, посильная нагрузка и сохранённые командные договорённости.</p><p>По M1 Product Vision · 2 октября 2026</p><div class="diagram" role="img" aria-label="React-клиент обращается к Fastify API; серверные модули хранят данные в PostgreSQL">{svg}</div>{''.join(htmlsections)}</main></html>'''
(ROOT/'FairShare-architecture.html').write_text(page,encoding='utf-8')
print('Exported FairShare-architecture.pdf and FairShare-architecture.html')
