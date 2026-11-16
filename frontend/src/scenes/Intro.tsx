import { useEffect, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/*
 * Portada: papel crema con el título al centro, garabatos de tinta alrededor (se dibujan solos)
 * y las fotos de época como polaroids grandes, tiradas sobre la mesa: algunas se salen de la
 * pantalla. Se mueven un poco con el mouse (cada una a distinta profundidad) y se mecen.
 */

interface Polaroid {
  src: string; alt: string; caption: string;
  /** posición y tamaño en unidades --iu (1/100 del ancho de un escenario 16:9) */
  style: CSSProperties; rotate: number; depth: number; ratio: string;
}

const POLAROIDS: Polaroid[] = [
  { src: '/assets/notes/manchester-lab.webp', alt: 'Las primeras computadoras de la Universidad de Mánchester', caption: 'Mánchester, 1949',
    style: { left: 'calc(-7 * var(--iu))', top: 'calc(-6 * var(--iu))', width: 'calc(36 * var(--iu))' }, rotate: -9, depth: 1.4, ratio: '4 / 3' },
  { src: '/assets/notes/tarski.webp', alt: 'Alfred Tarski frente a una pizarra', caption: 'Tarski y su pizarra',
    style: { right: 'calc(-4 * var(--iu))', top: 'calc(-9 * var(--iu))', width: 'calc(29 * var(--iu))' }, rotate: 8, depth: 1, ratio: '1 / 1' },
  { src: '/assets/notes/godel.jpg', alt: 'Retrato de Kurt Gödel', caption: 'Gödel, pensando',
    style: { left: 'calc(-3 * var(--iu))', bottom: 'calc(-13 * var(--iu))', width: 'calc(28 * var(--iu))' }, rotate: 6, depth: 0.8, ratio: '1 / 1' },
  { src: '/assets/notes/bletchley-park.webp', alt: 'Alan Turing con colegas criptoanalistas', caption: 'Bletchley Park',
    style: { right: 'calc(-9 * var(--iu))', bottom: 'calc(-8 * var(--iu))', width: 'calc(38 * var(--iu))' }, rotate: -6, depth: 1.6, ratio: '4 / 3' },
];

/**
 * Garabatos y símbolos se ubican respecto del CENTRO de la hoja (donde está el título), en los
 * huecos que dejan el título, el botón y las fotos: así nunca quedan encima de nada.
 * at(x, y): esquina superior izquierda a x, y unidades --iu del centro.
 */
const at = (x: number, y: number, rotate?: string): CSSProperties => ({
  left: `calc(50% + ${x} * var(--iu))`, top: `calc(50% + ${y} * var(--iu))`, ...(rotate ? { rotate } : {}),
});

/** Garabatos de tinta: trazos SVG que se dibujan al entrar. */
interface Scribble { d: string; view: string; style: CSSProperties; color: string; width?: number; delay: number }
const SCRIBBLES: Scribble[] = [
  // espiral: arriba a la izquierda del título
  { d: 'M50 50 m-3 0 a3 3 0 1 1 6 0 a7 7 0 1 1 -14 0 a11 11 0 1 1 22 0 a15 15 0 1 1 -30 0 a19 19 0 1 1 38 0', view: '0 0 100 100',
    style: { ...at(-20, -23), width: 'calc(5 * var(--iu))' }, color: '#7a3566', delay: 1.1 },
  // flecha curva: en el hueco de la izquierda, apunta al subtítulo
  { d: 'M5 70 C 25 20, 70 5, 105 30 M92 16 L106 31 L88 37', view: '0 0 115 80',
    style: { ...at(-35, 0.5, '-10deg'), width: 'calc(8 * var(--iu))' }, color: '#2b5797', delay: 1.4 },
  // estrella: arriba a la derecha del título
  { d: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z', view: '0 0 100 100',
    style: { ...at(17, -21.5, '12deg'), width: 'calc(4 * var(--iu))' }, color: '#c98a1e', delay: 1.6 },
  // zigzag: a la derecha del botón
  { d: 'M5 30 Q 15 5, 25 30 T 45 30 T 65 30 T 85 30 T 105 30', view: '0 0 110 45',
    style: { ...at(11.5, 11, '-6deg'), width: 'calc(6 * var(--iu))' }, color: '#2e5e4e', delay: 1.8 },
  // bucles: a la izquierda del botón
  { d: 'M5 40 C 15 5, 35 5, 30 30 C 25 50, 50 50, 50 25 C 50 5, 75 5, 70 30 C 65 50, 90 50, 95 20', view: '0 0 100 55',
    style: { ...at(-19.5, 12, '8deg'), width: 'calc(8 * var(--iu))' }, color: '#1d1a33', delay: 2 },
];

/** Símbolos de lógica escritos a mano, sueltos por la hoja. */
const NOTES: Array<{ text: string; style: CSSProperties; color: string; size: number }> = [
  { text: '∀x', style: at(-8, -25, '-12deg'), color: '#2b5797', size: 3.4 },
  { text: '∃y', style: at(9, -24.5, '9deg'), color: '#7a3566', size: 3.2 },
  { text: 'P(x) → Q(x)', style: at(-48, 5, '-5deg'), color: '#1d1a33', size: 2.2 },
  { text: 'D = {1, 2, 3}', style: at(25, -1.5, '4deg'), color: '#2e5e4e', size: 2.2 },
  { text: '¬', style: at(39, -4, '-8deg'), color: '#1d1a33', size: 3 },
  { text: 'V / F', style: at(-15, 18.5, '7deg'), color: '#b0332a', size: 2.4 },
];

export function Intro() {
  const navigate = useNavigate();
  const root = useRef<HTMLElement>(null);
  const start = () => navigate('/activacion');

  // Enter también empieza
  useEffect(() => {
    // (si se llegó con el enlace del panel, ese enlace tiene el foco: se suelta para que Enter no lo «pulse» otra vez)
    (document.activeElement as HTMLElement | null)?.blur();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); start(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paralaje suave: el mouse mueve las fotos (cada una a su profundidad) sin re-renderizar
  const onMove = (e: React.MouseEvent) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty('--px', String(e.clientX / window.innerWidth - 0.5));
    el.style.setProperty('--py', String(e.clientY / window.innerHeight - 0.5));
  };

  return (
    <motion.section ref={root} className="intro" aria-label="Portada" onMouseMove={onMove}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: 'easeInOut' }}>

      {POLAROIDS.map((p, i) => (
        <div key={p.src} className="intro-polaroid-pos" style={{ ...p.style, '--depth': p.depth } as CSSProperties}>
          <motion.figure className="intro-polaroid"
            initial={{ opacity: 0, scale: 1.18, rotate: p.rotate - 10, y: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: p.rotate, y: 0 }}
            transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.25 + i * 0.18 }}>
            <div className="intro-polaroid-sway" style={{ animationDelay: `${-i * 1.7}s` }}>
              <img src={p.src} alt={p.alt} draggable={false} style={{ aspectRatio: p.ratio }} />
              <figcaption>{p.caption}</figcaption>
            </div>
          </motion.figure>
        </div>
      ))}

      {SCRIBBLES.map((s, i) => (
        <svg key={i} className="intro-scribble" viewBox={s.view} style={s.style} aria-hidden="true">
          <motion.path d={s.d} fill="none" stroke={s.color} strokeWidth={s.width ?? 3.2} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
            transition={{ pathLength: { duration: 1.2, ease: 'easeInOut', delay: s.delay }, opacity: { duration: 0.2, delay: s.delay } }} />
        </svg>
      ))}

      {NOTES.map((n, i) => (
        <motion.span key={n.text} className="intro-note" aria-hidden="true" style={{ ...n.style, color: n.color, fontSize: `calc(${n.size} * var(--iu))` }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 0.85, y: 0 }} transition={{ delay: 1.2 + i * 0.15, duration: 0.5 }}>
          {n.text}
        </motion.span>
      ))}

      <div className="intro-center">
        <motion.h1 className="intro-title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
          <span>La Máquina</span>
          <span>de Turing</span>
        </motion.h1>
        {/* subrayado a mano */}
        <svg className="intro-underline" viewBox="0 0 480 40" aria-hidden="true">
          <motion.path d="M8 24 C 90 8, 170 34, 250 18 S 400 10, 472 22" fill="none" stroke="#2b5797" strokeWidth="5" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1, duration: 0.9, ease: 'easeInOut' }} />
          <motion.path d="M40 32 C 140 22, 300 36, 440 28" fill="none" stroke="#2b5797" strokeWidth="3" strokeLinecap="round" opacity=".6"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.5, duration: 0.7, ease: 'easeInOut' }} />
        </svg>
        <motion.p className="intro-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.6 }}>
          un evaluador semántico de lógica de primer orden
        </motion.p>
        <motion.button type="button" className="intro-start" onClick={start}
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.8, type: 'spring', stiffness: 220, damping: 16 }}>
          ▶ Comenzar
        </motion.button>
        <motion.span className="intro-hint" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 2.4 }}>
          o presiona Enter
        </motion.span>
      </div>
    </motion.section>
  );
}
