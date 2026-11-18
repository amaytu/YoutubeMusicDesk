import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
# vertical gradient rounded square
grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
for y in range(S):
    t = y / S
    gd.line([(0, y), (S, y)], fill=(int(124 + (236-124)*t), int(58 + (72-58)*t), int(237 + (153-237)*t), 255))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([40, 40, S-40, S-40], radius=220, fill=255)
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)
# equalizer bars
heights = [300, 520, 420, 620, 360]
bw, gap = 110, 46
total = len(heights)*bw + (len(heights)-1)*gap
x = (S - total)//2
base = 780
for h in heights:
    d.rounded_rectangle([x, base-h, x+bw, base], radius=50, fill=(255, 255, 255, 255))
    x += bw + gap
img.save(f"{out}/icon.png")
for name, size in [("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)]:
    img.resize((size, size), Image.LANCZOS).save(f"{out}/{name}")
img.save(f"{out}/icon.ico", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
