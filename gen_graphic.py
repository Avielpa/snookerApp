import json, urllib.parse, qrcode
from PIL import Image, ImageDraw, ImageFont

d = json.load(open('today_dump.json'))
g = d['groups'][0]
finished = [m for m in g['matches'] if m['status_code'] == 3]
upcoming = [m for m in g['matches'] if m['status_code'] == 0]

def link(source, medium, campaign):
    inner = f'utm_source={source}&utm_medium={medium}&utm_campaign={campaign}'
    ref = urllib.parse.quote(inner, safe='')
    return f'https://play.google.com/store/apps/details?id=com.avielpahima.maxbreaksnooker&referrer={ref}'

url = link('facebook', 'group_post', 'english_open_r16_0910')

W, H = 1080, 1350
BG = (10, 40, 24)
GOLD = (212, 175, 55)
WHITE = (245, 245, 240)
GREEN_LIVE = (70, 200, 120)
GREY = (170, 180, 175)
RED = (220, 70, 70)

img = Image.new('RGB', (W, H), BG)
dr = ImageDraw.Draw(img)

def font(sz, bold=False):
    try:
        path = "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"
        return ImageFont.truetype(path, sz)
    except Exception:
        return ImageFont.load_default()

f_title = font(58, True)
f_sub = font(30, True)
f_head = font(34, True)
f_name = font(30)
f_score = font(34, True)
f_small = font(24)

# header band
dr.rectangle([0,0,W,140], fill=(8,28,18))
dr.text((40,30), "MaxBreak", font=f_title, fill=GOLD)
dr.text((40,95), "ENGLISH OPEN — Round of 16", font=f_sub, fill=WHITE)

y = 170
dr.text((40,y), "SELBY OUT!", font=font(46, True), fill=RED)
y += 60
dr.text((40,y), "Kyren Wilson fights back to win 4-3", font=f_head, fill=WHITE)
y += 60

dr.line([(40,y),(W-40,y)], fill=(60,90,70), width=2)
y += 25
dr.text((40,y), "RESULTS", font=f_head, fill=GOLD)
y += 50

for m in finished:
    p1, s1, p2, s2 = m['player1_name'], m['score1'], m['player2_name'], m['score2']
    w1 = s1 > s2
    row_h = 56
    dr.rectangle([40, y, W-40, y+row_h-10], fill=(16,50,32))
    n1_col = WHITE if w1 else GREY
    n2_col = GREY if w1 else WHITE
    dr.text((60, y+10), p1, font=f_name, fill=n1_col)
    dr.text((W-140, y+10), str(s1), font=f_score, fill=n1_col)
    dr.text((W-100, y+10), "-", font=f_score, fill=GREY)
    dr.text((W-70, y+10), str(s2), font=f_score, fill=n2_col)
    y += row_h
    dr.text((60, y+2), p2, font=f_name, fill=n2_col)
    y += 46

y += 15
dr.line([(40,y),(W-40,y)], fill=(60,90,70), width=2)
y += 25
dr.text((40,y), "UP NEXT TODAY", font=f_head, fill=GOLD)
y += 50
for m in upcoming:
    p1, p2 = m['player1_name'], m['player2_name']
    dr.ellipse([44, y+14, 56, y+26], fill=GREEN_LIVE)
    dr.text((66, y+4), f"{p1}  vs  {p2}", font=f_name, fill=WHITE)
    y += 44

# QR + footer
qr = qrcode.QRCode(border=2, box_size=6)
qr.add_data(url)
qr.make()
qimg = qr.make_image(fill_color="black", back_color="white").convert('RGB')
qimg = qimg.resize((160,160))
img.paste(qimg, (W-200, H-210))

dr.rectangle([0, H-90, W, H], fill=(8,28,18))
dr.text((40, H-70), "Live scores, draws & stats — free on MaxBreak", font=f_small, fill=WHITE)
dr.text((40, H-40), "Search 'MaxBreak' on Google Play / App Store", font=f_small, fill=GREY)

img.save('english_open_r16_graphic.png')
print("saved, url=", url)
