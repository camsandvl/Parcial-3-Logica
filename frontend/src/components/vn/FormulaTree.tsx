import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Interpretation, TraceNode } from '@contracts/types';

const KIND: Record<TraceNode['kind'], string> = {
  witness: 'testigo', counterexample: 'contraejemplo', full_check: 'comprobación completa', connective: 'conectivo', atomic: 'átomo',
};

/** Medidas en unidades u (las mismas de la escena), convertidas a px al dibujar. */
const NODE_H = 5.2;
const LEVEL = 16;   // distancia vertical entre niveles (deja lugar para la cuenta, los casos probados y la etiqueta del hilo)
const GAP = 3;      // separación horizontal entre subárboles
const nodeW = (n: TraceNode) => Math.min(34, Math.max(12, (n.text ?? '').length * 0.95 + 5));

/** Inclinación pequeña y fija por nota (siempre la misma para la misma parte). */
const tilt = (path: string) => ([-2.2, 1.6, -1.2, 2.1, -1.8, 1.1][[...path].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 6]);

interface Placed { path: string; node: TraceNode; x: number; y: number; w: number; parent: string | null }

/** Acomoda el árbol: cada nodo queda centrado sobre sus hijos (árbol ordenado y simétrico). */
function layout(root: TraceNode): { nodes: Placed[]; width: number; height: number } {
  const span = (n: TraceNode): number => Math.max(nodeW(n), n.children.reduce((s, c, i) => s + span(c) + (i ? GAP : 0), 0));
  const out: Placed[] = [];
  const place = (n: TraceNode, path: string, left: number, depth: number, parent: string | null) => {
    const sw = span(n);
    out.push({ path, node: n, x: left + sw / 2, y: depth * LEVEL, w: nodeW(n), parent });
    const kids = n.children.reduce((s, c, i) => s + span(c) + (i ? GAP : 0), 0);
    let cx = left + (sw - kids) / 2;
    n.children.forEach((c, i) => { place(c, `${path}.${i}`, cx, depth + 1, path); cx += span(c) + GAP; });
  };
  place(root, 'r', 0, 0, null);
  const depth = Math.max(...out.map((p) => p.y)) / LEVEL;
  return { nodes: out, width: span(root), height: depth * LEVEL + NODE_H + 4 };
}


const OP: Partial<Record<TraceNode['node'], string>> = { not: '¬', and: '∧', or: '∨', implies: '→', iff: '↔' };
const VF = ({ v }: { v: boolean }) => <b className={v ? 'is-true' : 'is-false'}>{v ? 'V' : 'F'}</b>;

/** La cuenta del conectivo con los valores de sus partes: V → F = F. */
function Calc({ n }: { n: TraceNode }) {
  const op = OP[n.node];
  if (n.kind !== 'connective' || !op) return null;
  const [a, b] = n.children;
  if (n.node === 'not') return <>{op}{a ? <VF v={a.value} /> : '…'} = <VF v={n.value} /></>;
  return <>{a ? <VF v={a.value} /> : '…'} {op} {b ? <VF v={b.value} /> : '…'} = <VF v={n.value} /></>;
}

/** La consulta al mundo de un átomo: ¿(1, 2) ∈ R = {…}? → sí. */
function lookup(n: TraceNode, interp: Interpretation): { q: string; set: string; yes: boolean } | null {
  if (n.kind !== 'atomic' || !n.text) return null;
  const tail = n.text.split('=').pop()!.trim();          // "R(1, f(1)) = R(1, 2)" → "R(1, 2)"
  const m = tail.match(/^([A-Za-z]\w*)\(([^()]*)\)$/);
  if (!m) return null;
  const [, name, rawArgs] = m;
  const tuples = interp.predicates[name];
  if (!tuples) return null;
  const args = rawArgs.split(',').map((s) => s.trim());
  const show = (tu: string[]) => (tu.length > 1 ? `(${tu.join(', ')})` : tu[0]);
  const items = tuples.map(show);
  return {
    q: `${show(args)} ∈ ${name}`,
    set: `{${items.slice(0, 6).join(', ')}${items.length > 6 ? ', …' : ''}}`,
    yes: tuples.some((tu) => tu.join(',') === args.join(',')),
  };
}

interface Props {
  root: TraceNode;
  shown: Set<string>;
  current: string | null;
  /** true: ya se recorrió todo; la cámara muestra el árbol completo (o la parte elegida). */
  overview: boolean;
  onPick: (path: string, node: TraceNode) => void;
  /** El mundo de Tarski, para mostrar la consulta de cada átomo. */
  interpretation: Interpretation;
}

/**
 * Árbol de la fórmula dibujado a mano con luz: los nodos se van revelando y una "cámara"
 * se acerca con un movimiento suave a la parte que se explica (más grande y legible);
 * al final se aleja para mostrar el árbol completo.
 */
export function FormulaTree({ root, shown, current, overview, onPick, interpretation }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 0, h: 0, u: 10 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const u = parseFloat(getComputedStyle(el).getPropertyValue('--u')) || 10;
      setView({ w: el.clientWidth, h: el.clientHeight, u });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes, width, height } = useMemo(() => layout(root), [root]);
  const byPath = useMemo(() => Object.fromEntries(nodes.map((n) => [n.path, n])), [nodes]);
  const { u } = view;

  // Cámara: en el recorrido enfoca la parte actual (y su padre, para no perder el contexto);
  // en la vista general, el árbol completo.
  const camera = (() => {
    if (!view.w) return { x: 0, y: 0, s: 1 };
    let x0: number, x1: number, y0: number, y1: number;
    const cur = current ? byPath[current] : null;
    if (overview && !cur) { x0 = 0; x1 = width; y0 = 0; y1 = height; }
    else {
      const focus = cur ? [cur, ...(cur.parent && !overview ? [byPath[cur.parent]] : [])] : [byPath.r];
      x0 = Math.min(...focus.map((f) => f.x - f.w / 2)); x1 = Math.max(...focus.map((f) => f.x + f.w / 2));
      y0 = Math.min(...focus.map((f) => f.y)); y1 = Math.max(...focus.map((f) => f.y + NODE_H + 5));
    }
    const pad = 2.5;
    const bw = (x1 - x0 + 2 * pad) * u, bh = (y1 - y0 + 2 * pad) * u;
    // Más grande: al enfocar una parte se acerca hasta 1.75×; la vista general llena el espacio (hasta 2×)
    const s = Math.min(overview && !cur ? 2 : 1.75, view.w / bw, view.h / bh);
    const cx = ((x0 + x1) / 2) * u, cy = ((y0 + y1) / 2) * u;
    return { x: view.w / 2 - cx * s, y: view.h / 2 - cy * s, s };
  })();

  const visible = nodes.filter((n) => shown.has(n.path));
  // Movimiento suave y continuo (misma curva para la cámara y para las notas que se van)
  const glide = { duration: 0.95, ease: [0.45, 0, 0.2, 1] as [number, number, number, number] };
  const worldStyle = { width: width * u, height: height * u };

  // Las notas que quedan por encima de la parte enfocada se van del todo hacia arriba:
  // se desplazan LIFT unidades (bastante más que el alto de la pantalla) y su hilo se estira.
  const LIFT = 140;
  const focusTop = (() => {
    if (overview) return -Infinity;
    const cur = current ? byPath[current] : null;
    if (!cur) return -Infinity;
    return cur.parent ? byPath[cur.parent].y : cur.y;
  })();
  const lift = (p: Placed) => (p.y < focusTop ? LIFT * u : 0);

  return (
    <div className="ft" ref={box}>
      {/* Hilos: capa sin recorte, así un hilo cuya nota salió de vista sigue hasta el borde de la pantalla */}
      <motion.div className="ft-world ft-world-links" style={worldStyle} animate={{ x: camera.x, y: camera.y, scale: camera.s }} transition={glide}>
        <svg className="ft-links" width={width * u} height={height * u}>
          {visible.filter((n) => n.parent && shown.has(n.parent)).map((n) => {
            const p = byPath[n.parent!];
            const x1 = p.x * u, y1 = (p.y + NODE_H) * u - lift(p), x2 = n.x * u, y2 = n.y * u - lift(n);
            const my = (y1 + y2) / 2;
            // Hilo de color con una leve caída (como un hilo colgando entre dos chinchetas);
            // si su nota de arriba se fue, el hilo se estira con ella.
            const sag = Math.min(1.6 * u, Math.abs(x2 - x1) * 0.08);
            const d = `M${x1} ${y1} C${x1} ${my + sag}, ${x2} ${my + sag}, ${x2} ${y2}`;
            return (
              <g key={n.path} className={n.node.value ? 'is-true' : 'is-false'}>
                <motion.path initial={{ pathLength: 0, opacity: 0, d }} animate={{ pathLength: 1, opacity: 1, d }}
                  transition={{ pathLength: { duration: 0.7, ease: 'easeInOut' }, opacity: { duration: 0.3 }, d: glide }} />
                <motion.circle r={0.42 * u} className="ft-pin" initial={{ scale: 0, cx: x1, cy: y1 - 0.15 * u }} animate={{ scale: 1, cx: x1, cy: y1 - 0.15 * u }} transition={glide} />
                <motion.circle r={0.42 * u} className="ft-pin" initial={{ scale: 0, cx: x2, cy: y2 + 0.15 * u }} animate={{ scale: 1, cx: x2, cy: y2 + 0.15 * u }} transition={{ ...glide, scale: { delay: 0.6 } }} />
              </g>

            );
          })}
        </svg>
        {/* Etiqueta en el hilo que baja de un cuantificador: el elemento que se está probando */}
        {visible.filter((n) => n.parent && shown.has(n.parent) && byPath[n.parent].node.decisive).map((n) => {
          const p = byPath[n.parent!];
          const mx = ((p.x + n.x) / 2) * u, my = ((p.y + NODE_H - (lift(p) / u)) + (n.y - lift(n) / u)) / 2 * u;
          const d = p.node.decisive!;
          return (
            <motion.span key={`lbl-${n.path}`} className="ft-assign" style={{ fontSize: u }}
              initial={{ opacity: 0, scale: 0.6, left: mx, top: my }} animate={{ opacity: 1, scale: 1, left: mx, top: my }} transition={{ ...glide, opacity: { delay: 0.5 } }}>
              {Object.entries(d).map(([k, v]) => `${k} = ${v}`).join(', ')}
            </motion.span>
          );
        })}
      </motion.div>

      {/* Notas: pueden salir por arriba hasta el borde de la pantalla (se ven irse); se recortan a los lados y abajo */}
      <div className="ft-clip">
      <motion.div className="ft-world" style={worldStyle} animate={{ x: camera.x, y: camera.y, scale: camera.s }} transition={glide}>
        {visible.map((n) => (
          <motion.div key={n.path} className="ft-slot" style={{ left: (n.x - n.w / 2) * u, top: n.y * u, width: n.w * u }}
            initial={false} animate={{ y: -lift(n) }} transition={glide}>
            <motion.button type="button"
              className={`ft-node ${n.node.value ? 'is-true' : 'is-false'} ${current === n.path ? 'is-sel' : ''}`}
              style={{ height: NODE_H * u, fontSize: u, rotate: `${tilt(n.path)}deg` }}
              onClick={() => onPick(n.path, n.node)}
              initial={{ scale: 0.4, opacity: 0, y: -1.5 * u }} animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16, delay: n.parent ? 0.45 : 0 }}>
              <span className="ft-text">{n.node.text}</span>
              <span className="ft-meta">{KIND[n.node.kind]}</span>
              {/* sello V / F en la esquina de la nota */}
              <span className="ft-stamp">{n.node.value ? 'V' : 'F'}</span>
            </motion.button>
            {n.node.kind === 'connective' && OP[n.node.node] && (
              <motion.div className="ft-calc" style={{ fontSize: u }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <Calc n={n.node} />
              </motion.div>
            )}
            {(() => {
              const l = lookup(n.node, interpretation);
              return l && (
                <motion.div className="ft-calc ft-lookup" style={{ fontSize: u }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  ¿{l.q} = {l.set}? → <b className={l.yes ? 'is-true' : 'is-false'}>{l.yes ? 'sí' : 'no'}</b>
                </motion.div>
              );
            })()}
            {n.node.checked && n.node.var && current === n.path && (
              <motion.div className="ft-checks" style={{ fontSize: u }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                {n.node.checked.map((row, i) => {
                  const v = n.node.var!;
                  const decisive = n.node.decisive && n.node.decisive[v] === row[v];
                  return <span key={i} className={`ft-check ${row.value ? 'is-true' : 'is-false'} ${decisive ? 'is-decisive' : ''}`}>{v} = {row[v]}</span>;
                })}
              </motion.div>
            )}
          </motion.div>
        ))}
      </motion.div>
      </div>
    </div>
  );
}
