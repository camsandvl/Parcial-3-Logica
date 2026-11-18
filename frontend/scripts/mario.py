"""Prepara a Mario para el frontend a partir de su foto: lo recorta de las personas de
sus lados, le quita la gorra (pinta cabello en su lugar) y lo pasa a estilo caricatura
(colores planos y líneas oscuras) para que combine con Turing, Gödel y Tarski.

Uso (desde frontend/):
    python scripts/mario.py
    python scripts/cutout.py public/assets/characters/mario      # agrega el contorno crema

Entrada : public/assets/characters/mario/photos/mario-original.jpg
Salida  : public/assets/characters/mario/mario-neutral.png (750x1080, fondo transparente)
Requiere: pip install pillow numpy opencv-python-headless
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'characters' / 'mario'
SRC = ROOT / 'photos' / 'mario-original.jpg'
OUT = ROOT / 'mario-neutral.png'

# Silueta aproximada de Mario sobre la foto original (738x1600), horario desde la coronilla.
# Sirve de arranque para GrabCut, que ajusta el borde real. Deja fuera a las personas de sus lados.
OUTLINE = [
    (219, 285), (216, 262), (221, 235), (234, 208), (255, 188), (285, 171), (320, 166), (355, 172),
    (380, 190), (395, 218), (402, 248), (398, 272), (394, 290), (396, 340), (392, 380), (380, 415),
    (360, 452), (400, 470), (440, 486), (462, 508), (462, 540), (448, 596), (448, 650), (443, 720),
    (425, 780), (410, 820), (408, 900), (412, 960), (424, 1030), (428, 1060), (428, 1190),
    (160, 1190), (163, 1080), (166, 900), (167, 700), (156, 640), (134, 602), (132, 560), (152, 520),
    (190, 470), (238, 440), (232, 410), (218, 375), (212, 345), (213, 310),
]
# Zona de la gorra (se cubre con cabello): contorno de la cúpula del pelo.
HAIR_DOME = [
    (219, 288), (214, 262), (219, 233), (233, 206), (255, 185), (285, 168), (320, 162), (356, 168),
    (382, 187), (398, 216), (405, 248), (400, 274), (394, 292), (388, 268), (372, 249), (352, 239),
    (326, 233), (300, 232), (275, 236), (255, 246), (240, 259), (231, 276), (226, 290),
]
# Recuadro de la foto que queda en la imagen final (proporción 750x1080).
CROP = (38, 150, 558, 900)
FINAL = (750, 1080)


def k(r: int):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def cut_person(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    shape = np.zeros((h, w), np.uint8)
    cv2.fillPoly(shape, [np.array(OUTLINE, np.int32)], 255)
    gc = np.full((h, w), cv2.GC_BGD, np.uint8)
    gc[cv2.dilate(shape, k(9)) > 0] = cv2.GC_PR_BGD
    gc[shape > 0] = cv2.GC_PR_FGD
    gc[cv2.erode(shape, k(12)) > 0] = cv2.GC_FGD
    cv2.grabCut(img, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    mask = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
    mask = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k(3))


def paint_hair(img: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Cubre la gorra con cabello castaño oscuro (el de las patillas) y devuelve (imagen, máscara)."""
    h, w = img.shape[:2]
    s = 4  # supermuestreo para bordes suaves
    dome = Image.new('L', (w * s, h * s), 0)
    ImageDraw.Draw(dome).polygon([(x * s, y * s) for x, y in HAIR_DOME], fill=255)
    rng = np.random.default_rng(7)
    layer = Image.new('RGB', dome.size, (40, 29, 24))
    d = ImageDraw.Draw(layer)
    cx, cy = 322 * s, 176 * s  # de la coronilla salen los mechones hacia la frente
    for _ in range(2600):
        x, y = rng.uniform(210, 408) * s, rng.uniform(160, 296) * s
        ang = np.arctan2(y - cy, x - cx) + rng.normal(0, 0.18)
        length = rng.uniform(10, 26) * s
        bend = rng.normal(0, 0.25)
        pts = [(x, y)]
        for i in range(1, 5):
            a = ang + bend * i / 4
            pts.append((pts[-1][0] + np.cos(a) * length / 4, pts[-1][1] + np.sin(a) * length / 4))
        light = rng.normal(0, 20) + 42 * max(0, 1 - (y / s - 160) / 70) * (1 if x / s < 345 else .5)
        c = tuple(int(np.clip(v + light, 12, 120)) for v in (46, 33, 27))
        d.line(pts, fill=c, width=int(rng.uniform(1.2, 2.4) * s))
    layer = layer.filter(ImageFilter.GaussianBlur(s * .55))
    # sombra suave sobre la frente, justo bajo la línea del pelo
    soft = dome.filter(ImageFilter.GaussianBlur(s * 1.3)).resize((w, h), Image.LANCZOS)
    layer = layer.resize((w, h), Image.LANCZOS)
    a = np.asarray(soft, np.float32)[..., None] / 255
    out = (np.asarray(layer, np.float32) * a + img[..., ::-1] * (1 - a)).astype(np.uint8)[..., ::-1]
    # restos rojos de la gorra en el borde exterior de la cúpula (solo arriba y a los lados, nunca la frente)
    outer = Image.new('L', (w, h), 0)
    ImageDraw.Draw(outer).polygon(HAIR_DOME[:12], fill=255)
    outer = np.asarray(outer)
    fringe = (cv2.dilate(outer, k(5)) > 0) & (outer == 0)
    fringe[262:] = False  # de la línea del pelo hacia abajo está la cara: no se toca
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    redish = ((hsv[..., 0] < 14) | (hsv[..., 0] > 160)) & (hsv[..., 1] > 60)
    mask = np.where(fringe & redish, 0, mask).astype(np.uint8)
    mask = np.maximum(mask, np.asarray(dome.resize((w, h), Image.LANCZOS)))
    return np.ascontiguousarray(out), mask


def cartoon(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Colores planos + líneas oscuras, como los dibujos de Turing, Gödel y Tarski."""
    smooth = cv2.pyrMeanShiftFiltering(rgb, 9, 26)
    smooth = cv2.bilateralFilter(smooth, 9, 40, 9)
    lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    sel = alpha.reshape(-1) > 128
    _, labels, centers = cv2.kmeans(lab[sel], 11, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, .5), 3, cv2.KMEANS_PP_CENTERS)
    q = lab.copy()
    q[sel] = centers[labels.reshape(-1)]
    flat = cv2.cvtColor(q.reshape(rgb.shape).astype(np.uint8), cv2.COLOR_LAB2BGR)
    flat = cv2.medianBlur(flat, 5)
    # líneas: bordes de la imagen suavizada
    gray = cv2.cvtColor(smooth, cv2.COLOR_BGR2GRAY)
    edges = cv2.adaptiveThreshold(cv2.medianBlur(gray, 9), 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, 10)
    lines = cv2.erode(edges, k(1)) < 128
    # contorno exterior oscuro
    solid = (alpha > 128).astype(np.uint8)
    rim = cv2.dilate(solid, k(2)) - cv2.erode(solid, k(2))
    flat[lines & (alpha > 128)] = (28, 18, 22)
    flat[rim > 0] = (28, 18, 22)
    return flat


def main() -> None:
    img = cv2.imread(str(SRC))
    mask = cut_person(img)
    img, mask = paint_hair(img, mask)
    x0, y0, x1, y1 = CROP
    img, mask = img[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    img = cv2.resize(img, FINAL, interpolation=cv2.INTER_CUBIC)
    mask = cv2.resize(mask, FINAL, interpolation=cv2.INTER_CUBIC)
    mask = cv2.GaussianBlur(cv2.erode(mask, k(1)), (0, 0), 1.0)
    flat = cartoon(img, mask)
    rgba = cv2.cvtColor(flat, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = mask
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA)).save(OUT, optimize=True)
    print('ok', OUT)


if __name__ == '__main__':
    main()
