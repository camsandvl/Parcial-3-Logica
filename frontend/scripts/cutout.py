"""Convierte fotos de personajes en recortes estilo collage: contorno crema sólido.
La sombra no se hornea: se aplica con CSS (.vn-character img) para poder ajustarla.

Uso (desde frontend/):
    python scripts/cutout.py public/assets/characters/turing --mask turing-neutral.png

- Lee todos los PNG de la carpeta (excepto la subcarpeta cutout/).
- --mask: PNG cuya transparencia se aplica a todos. Sirve cuando las variantes
  (expresiones) tienen la misma silueta pero se exportaron con fondo sólido.
- Escribe los resultados en <carpeta>/cutout/ con el mismo nombre.
Requiere: pip install pillow numpy
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


CREAM = (246, 236, 214)


def outline(img: Image.Image, mask: Image.Image | None, width: int, color=CREAM) -> Image.Image:
    img = img.convert('RGBA')
    if mask is not None:
        img.putalpha(mask.convert('RGBA').getchannel('A'))

    # Margen para que el contorno no se corte en los bordes de arriba y los lados.
    pad = width + 4
    canvas = Image.new('RGBA', (img.width + 2 * pad, img.height + pad), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad))

    # Dilatación con un disco: máximo de la transparencia desplazada en todas las
    # direcciones dentro del radio. Da un borde sólido y nítido (sin degradado).
    alpha = np.array(canvas.getchannel('A'))
    alpha = np.where(alpha > 40, alpha, 0)  # ignora restos semitransparentes del recorte
    grown = alpha.copy()
    h, w = alpha.shape
    for dy in range(-width, width + 1):
        for dx in range(-width, width + 1):
            if dx * dx + dy * dy > width * width:
                continue
            shifted = np.zeros_like(alpha)
            shifted[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = \
                alpha[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
            np.maximum(grown, shifted, out=grown)
    # Suaviza solo 1 px para que el borde no se vea pixelado.
    grown_img = Image.fromarray(grown).filter(ImageFilter.GaussianBlur(0.7))

    ring = Image.new('RGBA', canvas.size, (*color, 0))
    ring.putalpha(grown_img)
    return Image.alpha_composite(ring, canvas)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('folder', type=Path)
    p.add_argument('--mask', help='PNG de la carpeta cuya transparencia se usa para todos')
    p.add_argument('--width', type=int, default=26, help='grosor del contorno en px')
    args = p.parse_args()

    out = args.folder / 'cutout'
    out.mkdir(exist_ok=True)
    mask = Image.open(args.folder / args.mask) if args.mask else None
    for f in sorted(args.folder.glob('*.png')):
        src = Image.open(f)
        if mask is not None and src.size != mask.size:
            raise SystemExit(f'{f.name} mide {src.size}, la máscara mide {mask.size}')
        outline(src, mask, args.width).save(out / f.name, optimize=True)
        print('ok', out / f.name)


if __name__ == '__main__':
    main()
