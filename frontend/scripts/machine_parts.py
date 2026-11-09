"""Extrae de machine-tape.png (la máquina de cinta, ya no se usa en la escena) las piezas que se animan por separado en la escena 1.

Uso (desde frontend/):
    python scripts/machine_parts.py

- reel-left.png / reel-right.png: los carretes, recortados en círculo (giran al encender).
- head.png: el cabezal de lectura/escritura (queda encima de la cinta que avanza).
Las coordenadas están medidas sobre machine-tape.png (1712x1079). Si se reemplaza la
imagen de la máquina, hay que volver a medirlas aquí y en src/components/vn/Machine.tsx.
Requiere: pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw

DIR = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'scene1'

REELS = {'reel-left': (200, 518), 'reel-right': (1485, 518)}  # centro (x, y)
REEL_RADIUS = 132
HEAD_BOX = (776, 428, 890, 606)  # izquierda, arriba, derecha, abajo


def main() -> None:
    machine = Image.open(DIR / 'machine-tape.png').convert('RGBA')
    for name, (cx, cy) in REELS.items():
        r = REEL_RADIUS
        crop = machine.crop((cx - r, cy - r, cx + r, cy + r))
        mask = Image.new('L', crop.size, 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
        alpha = Image.composite(crop.getchannel('A'), mask, mask)
        crop.putalpha(alpha)
        crop.save(DIR / f'{name}.png', optimize=True)
        print('ok', name)
    machine.crop(HEAD_BOX).save(DIR / 'head.png', optimize=True)
    print('ok head')


if __name__ == '__main__':
    main()
