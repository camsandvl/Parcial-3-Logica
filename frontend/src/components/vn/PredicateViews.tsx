import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Element } from '@contracts/types';

const OFFSETS = [0, -14, 8, -6, 12, -10];

/**
 * Predicado de aridad 1: se "pintan" en el mundo D los elementos donde es verdadero.
 * Lo pintado es exactamente el subconjunto P ⊆ D.
 */
export function PredicatePainter({ name, domain, holds, toggle }: {
  name: string;
  domain: Element[];
  holds: (e: Element) => boolean;
  toggle: (e: Element) => void;
}) {
  const on = domain.filter(holds);
  return (
    <div className="cp-wrap">
      <p className="fd-status">Haz clic en los elementos donde <b>{name}</b> es verdadero para pintarlos. Los que no pintes serán falsos.</p>
      <div className="domain-world" style={{ '--n': Math.max(1, domain.length) } as CSSProperties}>
        <span className="dw-label">D</span>
        <div className="dw-items">
          {domain.map((e, i) => (
            <button key={e} type="button" className={`dw-dot pp-dot ${holds(e) ? 'is-on' : ''}`} style={{ translate: `0 ${OFFSETS[i % 6]}%` }}
              onClick={() => toggle(e)} aria-pressed={holds(e)} aria-label={`${name}(${e}) ${holds(e) ? 'verdadero' : 'falso'}`}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <p className="fd-reading">
        <code>{name} = {'{'}{on.join(', ')}{'}'}</code>
        {on.length ? <> · {name} es verdadero en {on.join(', ')}</> : <> · todavía no es verdadero en ningún elemento</>}
      </p>
    </div>
  );
}

interface Pos { x: number; y: number }

/**
 * Predicado de aridad 2 como grafo: los elementos de D en un círculo y cada par (x, y)
 * donde R es verdadero es una flecha x → y. Un bucle en un elemento es R(x, x).
 * Clic en un elemento y luego en otro: agrega o quita la flecha. Clic en una flecha: la borra.
 */
export function RelationGraph({ name, domain, holds, toggle }: {
  name: string;
  domain: Element[];
  holds: (t: Element[]) => boolean;
  toggle: (t: Element[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [from, setFrom] = useState<Element | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Elementos repartidos sobre una elipse; el primero arriba.
  const n = domain.length;
  const r = Math.max(14, Math.min(30, (Math.min(size.w, size.h) * 1.6) / Math.max(n, 4) / 2)); // radio de cada bolita
  const pos: Record<Element, Pos> = {};
  domain.forEach((e, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
    pos[e] = n === 1
      ? { x: size.w / 2, y: size.h / 2 }
      : { x: size.w / 2 + size.w * 0.34 * Math.cos(a), y: size.h / 2 + (size.h * 0.5 - r - 58) * Math.sin(a) };
  });

  const pairs = domain.flatMap((a) => domain.filter((b) => holds([a, b])).map((b) => [a, b] as [Element, Element]));
  const cx = size.w / 2, cy = size.h / 2;

  /** Trazo de una flecha: curva leve (así x→y e y→x no se encimen) o bucle si x = y. */
  const path = (a: Element, b: Element) => {
    const p = pos[a], q = pos[b];
    if (a === b) {
      // Bucle hacia afuera del círculo
      const ang = Math.atan2(p.y - cy, p.x - cx);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const s = { x: p.x + r * Math.cos(ang - 0.6), y: p.y + r * Math.sin(ang - 0.6) };
      const t = { x: p.x + r * Math.cos(ang + 0.6), y: p.y + r * Math.sin(ang + 0.6) };
      const c1 = { x: p.x + (r + 58) * ux - 46 * uy, y: p.y + (r + 58) * uy + 46 * ux };
      const c2 = { x: p.x + (r + 58) * ux + 46 * uy, y: p.y + (r + 58) * uy - 46 * ux };
      return `M${s.x} ${s.y} C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${t.x} ${t.y}`;
    }
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const bend = 0.18 * len; // curvatura hacia la derecha del sentido de la flecha
    const mx = (p.x + q.x) / 2 - uy * bend, my = (p.y + q.y) / 2 + ux * bend;
    const s = { x: p.x + ux * r, y: p.y + uy * r };
    const t = { x: q.x - ux * (r + 6), y: q.y - uy * (r + 6) };
    return `M${s.x} ${s.y} Q${mx} ${my}, ${t.x} ${t.y}`;
  };

  const click = (e: Element) => {
    if (from === null) { setFrom(e); return; }
    toggle([from, e]);
    setFrom(null);
  };

  return (
    <div className="cp-wrap">
      <p className="fd-status">
        {from === null
          ? <>Haz clic en un elemento y luego en otro: la flecha <b>x → y</b> significa que <b>{name}(x, y)</b> es verdadero. Clic en una flecha para borrarla.</>
          : <>Elegiste <b>{from}</b>: ahora haz clic en el elemento con el que se relaciona (en <b>{from}</b> otra vez para {name}({from}, {from})).</>}
      </p>

      <div className="rg domain-world" ref={box} onClick={(ev) => { if (ev.target === ev.currentTarget) setFrom(null); }}>
        <span className="dw-label">D</span>
        <svg className="rg-arrows" width={size.w} height={size.h} aria-hidden="true">
          <defs>
            <marker id="rg-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#2e5e4e" />
            </marker>
          </defs>
          {size.w > 0 && pairs.map(([a, b]) => (
            <g key={`${a},${b}`} className="rg-edge" onClick={() => toggle([a, b])}>
              <title>{`${name}(${a}, ${b}) es verdadero · clic para borrar`}</title>
              <path d={path(a, b)} className="rg-hit" />
              <path d={path(a, b)} className="rg-line" markerEnd="url(#rg-head)" />
            </g>
          ))}
        </svg>
        {size.w > 0 && domain.map((e) => (
          <button key={e} type="button" className={`rg-dot ${from === e ? 'is-from' : ''}`}
            style={{ left: pos[e].x - r, top: pos[e].y - r, width: 2 * r, height: 2 * r, fontSize: r * 0.85 }}
            onClick={() => click(e)} aria-pressed={from === e} aria-label={from === null ? `Empezar flecha desde ${e}` : `${name}(${from}, ${e})`}>
            {e}
          </button>
        ))}
      </div>

      <p className="fd-reading">
        <code>{name} = {'{'}{pairs.map(([a, b]) => `(${a}, ${b})`).join(', ')}{'}'}</code>
        {pairs.length === 0 && <> · todavía no hay ninguna flecha</>}
      </p>
    </div>
  );
}
