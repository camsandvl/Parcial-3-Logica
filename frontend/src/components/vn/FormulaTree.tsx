import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Environment, Formula, Interpretation, Span, Term, TraceNode } from '@contracts/types';

/*
 * Árbol de la fórmula. La FORMA es el árbol sintáctico completo (sale del AST: todas las
 * ramas y también los términos), y encima se cuelga la traza del evaluador: cada nodo de la
 * traza se asocia a su nodo del AST por su span. Así se ven también las partes que el
 * evaluador no necesitó revisar (p. ej. la otra mitad de una «y» falsa), sin sello.
 *
 * Estilo: notas de papel pegadas con cinta, unidas por hilos de color con chinchetas; una
 * "cámara" se acerca con un movimiento suave a la parte que se explica y las notas que
 * quedan arriba se van hacia arriba estirando su hilo.
 */

const KIND: Record<TraceNode['kind'], string> = {
  witness: 'testigo', counterexample: 'contraejemplo', full_check: 'revisó todo D', connective: 'conectivo', atomic: 'átomo',
};

// ---------- Impresión (misma regla de paréntesis que backend/app/syntax/printer.py) ----------
const PREC: Partial<Record<Formula['type'], number>> = { iff: 1, implies: 2, or: 3, and: 4 };
const SYM: Record<string, string> = { iff: '↔', implies: '→', or: '∨', and: '∧', forall: '∀', exists: '∃' };
type Subst = Record<string, string>;
const prec = (f: Formula) => PREC[f.type] ?? 5;

function showTerm(t: Term, s: Subst, bound: Set<string>): string {
  if (t.type === 'var') return t.name in s && !bound.has(t.name) ? s[t.name] : t.name;
  return t.args.length ? `${t.name}(${showArgs(t.args, s, bound)})` : t.name;
}
function showArgs(args: Term[], s: Subst, bound: Set<string>) {
  const compound = args.some((a) => a.type === 'func' && a.args.length);
  return args.map((a) => showTerm(a, s, bound)).join(compound ? ', ' : ',');
}
function show(f: Formula, s: Subst, bound = new Set<string>()): string {
  switch (f.type) {
    case 'pred': return f.args.length ? `${f.name}(${showArgs(f.args, s, bound)})` : f.name;
    case 'not': { const b = show(f.body, s, bound); return PREC[f.body.type] ? `¬(${b})` : `¬${b}`; }
    case 'forall': case 'exists': {
      const b = show(f.body, s, new Set([...bound, f.var]));
      return PREC[f.body.type] ? `${SYM[f.type]}${f.var}(${b})` : `${SYM[f.type]}${f.var} ${b}`;
    }
    default: {
      const own = PREC[f.type]!, right = f.type === 'implies';
      let l = show(f.left, s, bound), r = show(f.right, s, bound);
      if (prec(f.left) < own || (prec(f.left) === own && right)) l = `(${l})`;
      if (prec(f.right) < own || (prec(f.right) === own && !right)) r = `(${r})`;
      return `${l} ${SYM[f.type]} ${r}`;
    }
  }
}

// ---------- Árbol combinado: AST + traza ----------
interface TNode {
  path: string;          // camino en el AST
  sym: string;           // lo que se escribe en el nodo: un solo símbolo (∀x, →, P, x, f…)
  text: string;          // la subfórmula (o el término) completa, para la nota de explicación
  meta: string;
  term: boolean;         // un término (variable o función), no una fórmula
  trace?: TraceNode;     // la parte de la traza que le corresponde (si el evaluador la revisó)
  tracePath?: string;    // su camino en la traza (el que usa el informe)
  reveal: string;        // aparece cuando se revela esta parte de la traza
  children: TNode[];
  /** Si es el cuerpo de un cuantificador: los casos probados (uno por elemento) se muestran AQUÍ,
   *  donde se calculan; el cuantificador solo aplica su regla al resultado. */
  cases?: { quant: TraceNode; body: Formula; subst: Subst; v: string };
  /** Cuerpo de un cuantificador revisado en todo D: dio lo mismo en todos los casos. */
  agg?: boolean;
  /** Valores de las variables en esta parte (para explicar los términos). */
  subst: Subst;
  /** El término mismo (solo en los términos), para calcular su valor al explicarlo. */
  termAst?: Term;
}

const sameSpan = (a: Span, b: Span) => a[0] === b[0] && a[1] === b[1];

function termNode(t: Term, path: string, s: Subst, reveal: string): TNode {
  const isVar = t.type === 'var';
  const val = isVar && t.name in s ? s[t.name] : null;
  return {
    path, reveal, term: true, subst: s, termAst: t,
    sym: t.name,
    text: showTerm(t, s, new Set()),
    meta: isVar ? (val ? `vale ${val}` : 'variable') : t.args.length ? 'función' : 'constante',
    children: isVar ? [] : t.args.map((a, i) => termNode(a, `${path}.${i}`, s, reveal)),
  };
}

/**
 * idle: qué decir de una parte que la traza no trae. «no hizo falta» si el evaluador no la
 * necesitó (la otra mitad de una «y» falsa…); «en cada caso» si se evaluó una vez por cada
 * elemento de un cuantificador revisado en todo D (la traza no guarda esos valores).
 */
function build(f: Formula, path: string, s: Subst, reveal: string, tr?: TraceNode, trPath?: string, idle = 'no hizo falta'): TNode {
  const here = tr && trPath ? trPath : reveal;
  const childIdle = tr ? 'no hizo falta' : idle;
  // A cada hijo del AST le toca el hijo de la traza con su mismo span (la traza omite ramas).
  const traceOf = (child: Formula) => {
    const i = tr ? tr.children.findIndex((c) => sameSpan(c.span, child.span)) : -1;
    return i < 0 ? {} : { tr: tr!.children[i], trPath: `${trPath}.${i}` };
  };
  const node: TNode = {
    path, reveal: here, term: false, trace: tr, tracePath: tr ? trPath : undefined, subst: s,
    sym: f.type === 'pred' ? f.name : f.type === 'forall' || f.type === 'exists' ? `${SYM[f.type]}${f.var}` : f.type === 'not' ? '¬' : SYM[f.type],
    text: tr?.text ?? show(f, s),
    meta: tr ? KIND[tr.kind] : idle,
    children: [],
  };
  switch (f.type) {
    case 'pred':
      node.children = f.args.map((a, i) => termNode(a, `${path}.${i}`, s, here));
      break;
    case 'not': {
      const c = traceOf(f.body);
      node.children = [build(f.body, `${path}.0`, s, here, c.tr, c.trPath, childIdle)];
      break;
    }
    case 'forall': case 'exists': {
      const c = traceOf(f.body);
      const el = tr?.decisive?.[f.var];
      // El cuerpo se muestra con el caso decisivo; si se revisó todo el dominio, sin sustituir.
      // La variable ligada tapa a una libre del mismo nombre: sin caso decisivo, no tiene un valor fijo
      const inner: Subst = { ...s };
      if (el) inner[f.var] = el; else delete inner[f.var];
      const body = build(f.body, `${path}.0`, inner, here, c.tr, c.trPath, tr && !c.tr ? 'en cada caso' : childIdle);
      if (tr?.checked?.length) {
        body.cases = { quant: tr, body: f.body, subst: s, v: f.var };
        // Sin caso decisivo, el cuerpo dio lo mismo con cada elemento: ese es su valor.
        if (!c.tr) { body.agg = tr.checked[0].value; body.meta = `en los ${tr.checked.length} casos`; }
      }
      node.children = [body];
      break;
    }
    default: {
      const l = traceOf(f.left), r = traceOf(f.right);
      // La rama que no hizo falta aparece junto con la que decidió el resultado.
      const with_ = l.trPath ?? r.trPath ?? here;
      node.children = [build(f.left, `${path}.0`, s, with_, l.tr, l.trPath, childIdle), build(f.right, `${path}.1`, s, with_, r.tr, r.trPath, childIdle)];
    }
  }
  return node;
}

/** Sin AST que coincida (p. ej. el modo simulado), el árbol es la traza tal cual. */
function fromTrace(t: TraceNode, path = 'r'): TNode {
  const sym = t.node === 'pred' ? (t.text ?? '').split('(')[0].trim() : t.node === 'not' ? '¬' : `${SYM[t.node]}${t.var ?? ''}`;
  return { path, sym, text: t.text ?? '', meta: KIND[t.kind], term: false, trace: t, tracePath: path, reveal: path, subst: {},
    children: t.children.map((c, i) => fromTrace(c, `${path}.${i}`)) };
}

// ---------- Acomodo ----------
/** Medidas en unidades u (las mismas de la escena), convertidas a px al dibujar. */
const NODE_H = 5.4;
const TERM_H = 4.4;
const LEVEL = 13;   // distancia vertical entre niveles (deja lugar para la nota de la parte que se explica y la etiqueta del hilo)
const GAP = 3.5;    // separación horizontal entre subárboles
/** En la vista general no hay nota ni casos debajo de ninguna parte: los niveles se juntan a
 *  esta distancia y el árbol completo cabe más grande. */
const OVERVIEW_LEVEL = 8.6;
// Un símbolo por nodo: notas pequeñas y parejas, como el árbol que se dibuja en clase
const nodeW = (n: TNode) => Math.max(n.term ? 5.5 : 7.5, n.sym.length * (n.term ? 1.6 : 2) + 4.5, n.meta.length * 0.8 + 2.5);
const nodeH = (n: TNode) => (n.term ? TERM_H : NODE_H);

/** Inclinación pequeña y fija por nota (siempre la misma para la misma parte). */
const tilt = (path: string) => ([-2.2, 1.6, -1.2, 2.1, -1.8, 1.1][[...path].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 6]);

interface Placed { path: string; n: TNode; x: number; y: number; w: number; h: number; parent: string | null }

/** Cada nodo queda centrado sobre sus hijos (árbol ordenado y simétrico). */
function layout(root: TNode): { nodes: Placed[]; width: number; height: number } {
  const span = (n: TNode): number => Math.max(nodeW(n), n.children.reduce((s, c, i) => s + span(c) + (i ? GAP : 0), 0));
  const out: Placed[] = [];
  const place = (n: TNode, left: number, depth: number, parent: string | null) => {
    const sw = span(n);
    out.push({ path: n.path, n, x: left + sw / 2, y: depth * LEVEL, w: nodeW(n), h: nodeH(n), parent });
    const kids = n.children.reduce((s, c, i) => s + span(c) + (i ? GAP : 0), 0);
    let cx = left + (sw - kids) / 2;
    n.children.forEach((c) => { place(c, cx, depth + 1, n.path); cx += span(c) + GAP; });
  };
  place(root, 0, 0, null);
  const depth = Math.max(...out.map((p) => p.y)) / LEVEL;
  return { nodes: out, width: span(root), height: depth * LEVEL + NODE_H + 4 };
}

const OP: Partial<Record<TraceNode['node'], string>> = { not: '¬', and: '∧', or: '∨', implies: '→', iff: '↔' };
const VF = ({ v }: { v?: boolean }) => (v === undefined ? <>…</> : <b className={v ? 'is-true' : 'is-false'}>{v ? 'V' : 'F'}</b>);

/** La cuenta del conectivo con los valores de sus partes: V → F = F (… si no hizo falta revisarla). */
function Calc({ n }: { n: TNode }) {
  const t = n.trace;
  const op = t && OP[t.node];
  if (!t || t.kind !== 'connective' || !op) return null;
  const [a, b] = n.children.map((c) => c.trace?.value);
  if (t.node === 'not') return <>{op}<VF v={a} /> = <VF v={t.value} /></>;
  return <><VF v={a} /> {op} <VF v={b} /> = <VF v={t.value} /></>;
}

/** La consulta al mundo de un átomo: ¿(1, 2) ∈ R = {…}? → sí. */
function lookup(t: TraceNode | undefined, interp: Interpretation): { q: string; set: string; yes: boolean } | null {
  if (!t || t.kind !== 'atomic' || !t.text) return null;
  const tail = t.text.split('=').pop()!.trim();          // "R(1, f(1)) = R(1, 2)" → "R(1, 2)"
  const m = tail.match(/^([A-Za-z]\w*)\(([^()]*)\)$/);
  if (!m) return null;
  const [, name, rawArgs] = m;
  const tuples = interp.predicates[name];
  if (!tuples) return null;
  const args = rawArgs.split(',').map((s) => s.trim());
  const fmt = (tu: string[]) => (tu.length > 1 ? `(${tu.join(', ')})` : tu[0]);
  const items = tuples.map(fmt);
  return {
    q: `${fmt(args)} ∈ ${name}`,
    set: `{${items.slice(0, 6).join(', ')}${items.length > 6 ? ', …' : ''}}`,
    yes: tuples.some((tu) => tu.join(',') === args.join(',')),
  };
}

/** Valor de un término en el mundo (variables por la sustitución, funciones por su tabla). */
function evalTerm(t: Term, s: Subst, interp: Interpretation): string {
  if (t.type === 'var') return s[t.name] ?? t.name;
  const args = t.args.map((a) => evalTerm(a, s, interp));
  const row = (interp.functions[t.name] ?? []).find(([a]) => a.join(',') === args.join(','));
  return row ? row[1] : '?';
}

/** Un caso probado por el cuantificador: el elemento, la parte con ese elemento y su valor. */
function caseRows(c: NonNullable<TNode['cases']>, interp: Interpretation) {
  return (c.quant.checked ?? []).map((row) => {
    const el = row[c.v] as string;
    const s = { ...c.subst, [c.v]: el };
    let ask: { q: string; yes: boolean } | null = null;
    if (c.body.type === 'pred') {
      const args = c.body.args.map((a) => evalTerm(a, s, interp));
      const fmt = args.length > 1 ? `(${args.join(', ')})` : args[0];
      ask = { q: args.length ? `${fmt} ∈ ${c.body.name}` : `${c.body.name} es verdadera`, yes: (interp.predicates[c.body.name] ?? []).some((tu) => tu.join(',') === args.join(',')) };
    }
    return { el, value: row.value, text: show(c.body, s), ask, decisive: c.quant.decisive?.[c.v] === el, gap: 0 };
  });
}

/** Con dominios grandes la lista se acorta: los dos primeros, «…» y los tres últimos (ahí está el decisivo). */
const MAX_CASES = 6;
function shortCases<T extends { gap: number }>(rows: T[]): T[] {
  if (rows.length <= MAX_CASES) return rows;
  const tail = rows.slice(-3);
  return [...rows.slice(0, 2), { ...tail[0], gap: rows.length - 5 }, ...tail.slice(1)];
}

/** Explicación de una parte que la traza no trae (para el clic del final). */
function explainUntraced(n: TNode, interp: Interpretation): string {
  if (n.term) {
    if (n.children.length === 0 && n.meta === 'constante') return `${n.sym} es una constante: en este mundo nombra al elemento ${evalConst(n.sym, interp)}.`;
    if (n.meta === 'función') {
      const v = n.termAst ? evalTerm(n.termAst, n.subst, interp) : '?';
      // '?' = alguna variable no tiene un valor fijo aquí (toma cada valor de D)
      return v === '?'
        ? `${n.sym} es una función: su valor depende del caso que se esté probando.`
        : `${n.sym} es una función: se busca en su tabla y ${n.text} vale ${v}.`;
    }
    return n.sym in n.subst ? `${n.sym} es una variable: en esta parte vale ${n.subst[n.sym]}.` : `${n.sym} es una variable ligada: toma cada valor de D, uno por caso.`;
  }
  if (n.agg !== undefined) return `${n.text} da ${n.agg ? 'verdadero' : 'falso'} con cada uno de los ${n.cases?.quant.checked?.length ?? 0} elementos probados: mira los casos debajo.`;
  if (n.meta === 'en cada caso') return `${n.text} se evaluó una vez por cada elemento del cuantificador de arriba; su valor cambia de un caso a otro.`;
  return `${n.text} no hizo falta revisarla: con la otra parte ya se sabía el resultado.`;
}
const evalConst = (name: string, interp: Interpretation) => (interp.functions[name] ?? []).find(([a]) => a.length === 0)?.[1] ?? '?';

/** La regla del cuantificador aplicada a sus casos: ∃ necesita al menos un V; ∀, todos V. */
function rule(t: TraceNode) {
  const v = t.var ?? '', rows = t.checked ?? [];
  const yes = rows.filter((r) => r.value).length;
  const d = t.decisive?.[v];
  if (t.node === 'exists') return { rule: '∃ necesita al menos un V', tally: d ? `${v} = ${d} lo es` : `${yes} de ${rows.length} son V` };
  return { rule: '∀ necesita que todos sean V', tally: d ? `${v} = ${d} da F` : `${yes} de ${rows.length} son V` };
}

interface Props {
  /** El AST de la fórmula (del parser): da la forma completa del árbol. */
  ast: Formula | null;
  root: TraceNode;
  /** Partes de la traza ya reveladas (caminos de la traza: 'r', 'r.0', …). */
  shown: Set<string>;
  current: string | null;
  /** true: ya se recorrió todo; la cámara muestra el árbol completo (o la parte elegida). */
  overview: boolean;
  /** Clic en una parte (al final). Para las partes que la traza no trae llega un nodo armado aquí y su explicación. */
  onPick: (path: string, node: TraceNode, explanation?: string) => void;
  /** El mundo de Tarski, para mostrar la consulta de cada átomo. */
  interpretation: Interpretation;
  /** Valores de las variables libres (para mostrar «x vale 1»). */
  environment?: Environment;
}

export function FormulaTree({ ast, root, shown, current, overview, onPick, interpretation, environment }: Props) {
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

  const tree = useMemo(
    () => (ast && ast.type === root.node && sameSpan(ast.span, root.span) ? build(ast, 'r', { ...environment }, 'r', root, 'r') : fromTrace(root)),
    [ast, root, environment],
  );
  const { nodes, width, height } = useMemo(() => layout(tree), [tree]);
  const byPath = useMemo(() => Object.fromEntries(nodes.map((n) => [n.path, n])), [nodes]);
  const byTrace = useMemo(() => Object.fromEntries(nodes.filter((n) => n.n.tracePath).map((n) => [n.n.tracePath!, n])), [nodes]);
  const { u } = view;
  const cur = current ? byTrace[current] ?? (current.startsWith('a:') ? byPath[current.slice(2)] ?? null : null) : null;

  // En el recorrido se ve el nivel de la parte actual: ella y sus hermanas (enmarcadas juntas, así
  // ninguna queda cortada en el borde) y, debajo, sus partes sin evaluar (términos, ramas que no
  // hicieron falta). Lo de arriba se va; lo más profundo de otras ramas aparece en la vista general.
  const sibs = cur ? nodes.filter((n) => n.parent === cur.parent && n.y === cur.y && (overview || shown.has(n.n.reveal))) : [];
  // Los casos se ven en el cuerpo cuando se explica el cuantificador o el cuerpo mismo
  const casesOn = (p: Placed) => !!p.n.cases && !!cur && (cur.path === p.parent || (cur === p && !p.n.trace?.checked));
  // Debajo: las partes sin evaluar (salvo si la parte muestra su lista de casos: esa lista ocupa
  // el lugar) y, si es un cuantificador, el cuerpo con sus casos
  const kids = cur ? nodes.filter((n) => n.parent === cur.path && ((!n.n.tracePath && n.n.reveal === cur.n.reveal && !casesOn(cur)) || casesOn(n))) : [];
  const rowsOf = (p: Placed) => (casesOn(p) ? Math.min(MAX_CASES, p.n.cases!.quant.checked?.length ?? 0) : 0);
  // Con una parte enfocada (en el recorrido o elegida con clic al final) la escena es la misma
  const inScene = (p: Placed) => !cur || p.y <= cur.y || kids.includes(p);

  // Desplazamiento vertical de cada nota (hacia arriba, en px): lo que sube al irse (LIFT) más,
  // en la vista general, lo que se acerca su nivel al de arriba (niveles juntos).
  const LIFT = 80;
  const focusTop = !cur ? -Infinity : cur.y; // todo lo que está arriba de la parte actual se va
  const lift = (p: Placed) => (p.y < focusTop ? LIFT * u : 0);
  const squeeze = overview && !cur ? 1 - OVERVIEW_LEVEL / LEVEL : 0;
  const off = (p: Placed) => lift(p) + p.y * squeeze * u;

  // Cámara: en el recorrido enmarca ese nivel; en la vista general, el árbol completo
  // (o, si se eligió una parte al final, esa parte).
  const camera = (() => {
    if (!view.w) return { x: 0, y: 0, s: 1 };
    let x0: number, x1: number, y0: number, y1: number;
    if (overview && !cur) { x0 = 0; x1 = width; y0 = 0; y1 = Math.max(...nodes.map((p) => p.y - off(p) / u + p.h)) + 1.5; }
    else {
      // solo lo que ya se ve: una parte que todavía no aparece no debe alejar la cámara
      const focus = !cur ? [byPath.r] : [...sibs, ...kids].filter((f) => f === cur || overview || shown.has(f.n.reveal));
      x0 = Math.min(...focus.map((f) => f.x - f.w / 2)); x1 = Math.max(...focus.map((f) => f.x + f.w / 2));
      y0 = Math.min(...focus.map((f) => f.y)); y1 = Math.max(...focus.map((f) => f.y + f.h + (rowsOf(f) ? 3 + rowsOf(f) * 3.1 : f === cur ? 6 : 1.5)));
    }
    const pad = 2.5;
    const bw = (x1 - x0 + 2 * pad) * u, bh = (y1 - y0 + 2 * pad) * u;
    // Al enfocar una parte se acerca hasta 1.75×; la vista general llena el espacio (hasta 2×)
    const s = Math.min(overview && !cur ? 2 : 1.75, view.w / bw, view.h / bh);
    const cx = ((x0 + x1) / 2) * u, cy = ((y0 + y1) / 2) * u;
    return { x: view.w / 2 - cx * s, y: view.h / 2 - cy * s, s };
  })();

  const isShown = (p: Placed) => overview || shown.has(p.n.reveal);
  const visible = nodes.filter((p) => isShown(p) && inScene(p));
  // Movimiento suave y continuo (misma curva para la cámara y para las notas que se van)
  const glide = { duration: 1.1, ease: [0.45, 0, 0.2, 1] as [number, number, number, number] };
  // Las notas que se van suben despacio al principio y luego se alejan (como si tiraran del hilo)
  const drift = { duration: 1.7, ease: [0.5, 0, 0.3, 1] as [number, number, number, number] };
  const worldStyle = { width: width * u, height: height * u };

  // Las notas que quedan por encima de la parte enfocada se van del todo hacia arriba:
  // se desplazan LIFT unidades (bastante más que el alto de la pantalla) y su hilo se estira
  // (ver off(), arriba).
  // Dónde estaba cada nota en el paso anterior: un hilo NUEVO nace desde ahí y viaja con su nota
  // (si naciera ya en la posición final, mientras la nota de arriba todavía sube el hilo se va de lado).
  const prevLift = useRef<Record<string, number>>({});
  const liftWas = (p: Placed) => prevLift.current[p.path] ?? off(p);
  useEffect(() => { prevLift.current = Object.fromEntries(nodes.map((n) => [n.path, off(n)])); });

  // Color del hilo: verde/rojo según el valor de la parte de abajo; las partes sin evaluar y los
  // términos cuelgan de un hilo de cáñamo (sin valor).
  const valueOf = (n: TNode) => n.trace?.value ?? n.agg;
  const cord = (n: TNode) => (valueOf(n) === undefined ? 'is-idle' : valueOf(n) ? 'is-true' : 'is-false');

  return (
    <div className="ft" ref={box}>
      {/* Hilos: recortados solo a los lados y abajo (no pasan sobre el diálogo); por arriba siguen
          hasta el borde de la pantalla cuando su nota se va */}
      <div className="ft-clip ft-clip-links">
      <motion.div className="ft-world ft-world-links" style={worldStyle} animate={{ x: camera.x, y: camera.y, scale: camera.s }} transition={glide}>
        <svg className="ft-links" width={width * u} height={height * u}>
          <AnimatePresence>
          {visible.filter((n) => n.parent && isShown(byPath[n.parent]) && inScene(byPath[n.parent])).map((n) => {
            const p = byPath[n.parent!];
            const x1 = p.x * u, x2 = n.x * u;
            // Hilo con una leve caída (como un hilo colgando entre dos chinchetas);
            // si su nota de arriba se fue, el hilo se estira con ella.
            const sag = Math.min(1.6 * u, Math.abs(x2 - x1) * 0.08);
            const path = (ly1: number, ly2: number) => {
              const a = (p.y + p.h) * u - ly1, b = n.y * u - ly2, my = (a + b) / 2;
              return { d: `M${x1} ${a} C${x1} ${my + sag}, ${x2} ${my + sag}, ${x2} ${b}`, y1: a, y2: b };
            };
            const { d, y1, y2 } = path(off(p), off(n));
            const was = path(liftWas(p), liftWas(n));
            return (
              <motion.g key={n.path} className={cord(n.n)} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
                <motion.path initial={{ pathLength: 0, opacity: 0, d: was.d }} animate={{ pathLength: 1, opacity: 1, d }}
                  transition={{ pathLength: { duration: 0.7, ease: 'easeInOut' }, opacity: { duration: 0.3 }, d: drift }} />
                <motion.circle r={0.42 * u} className="ft-pin" initial={{ scale: 0, cx: x1, cy: was.y1 - 0.15 * u }} animate={{ scale: 1, cx: x1, cy: y1 - 0.15 * u }} transition={drift} />
                <motion.circle r={0.42 * u} className="ft-pin" initial={{ scale: 0, cx: x2, cy: was.y2 + 0.15 * u }} animate={{ scale: 1, cx: x2, cy: y2 + 0.15 * u }} transition={{ ...drift, scale: { delay: 0.6 } }} />
              </motion.g>
            );
          })}
          </AnimatePresence>
        </svg>
        {/* Etiqueta en el hilo que baja de un cuantificador: el elemento que se está probando */}
        {visible.filter((n) => n.parent && isShown(byPath[n.parent]) && byPath[n.parent].n.trace?.decisive && !n.n.term).map((n) => {
          const p = byPath[n.parent!];
          const mx = (lift(p) ? n.x : (p.x + n.x) / 2) * u;
          // si la nota de arriba ya se fue, la etiqueta queda en el hilo justo encima de la parte actual
          const my = lift(p) ? (n.y - off(n) / u - 3.2) * u : ((p.y + p.h - off(p) / u) + (n.y - off(n) / u)) / 2 * u;
          const d = p.n.trace!.decisive!;
          return (
            <motion.span key={`lbl-${n.path}`} className="ft-assign" style={{ fontSize: u }}
              initial={{ opacity: 0, scale: 0.6, left: mx, top: my }} animate={{ opacity: 1, scale: 1, left: mx, top: my }} transition={{ ...drift, opacity: { delay: 0.5 } }}>
              {Object.entries(d).map(([k, v]) => `${k} = ${v}`).join(', ')}
            </motion.span>
          );
        })}
      </motion.div>
      </div>

      {/* Notas: pueden salir por arriba hasta el borde de la pantalla (se ven irse); se recortan a los lados y abajo */}
      <div className="ft-clip">
        <motion.div className="ft-world" style={worldStyle} animate={{ x: camera.x, y: camera.y, scale: camera.s }} transition={glide}>
          <AnimatePresence>
          {visible.map((p) => {
            const { n } = p;
            const t = n.trace;
            const val = valueOf(n);
            const withCases = casesOn(p);
            const l = withCases ? null : lookup(t, interpretation);
            return (
              <motion.div key={p.path} className="ft-slot" style={{ left: (p.x - p.w / 2) * u, top: p.y * u, width: p.w * u }}
                initial={false} animate={{ y: -off(p), opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} transition={drift}>
                <motion.button type="button"
                  className={`ft-node ${val === undefined ? 'is-idle' : val ? 'is-true' : 'is-false'} ${!t && val !== undefined ? 'is-agg' : ''} ${n.term ? 'is-term' : ''} ${cur?.path === p.path ? 'is-sel' : ''} ${cur && sibs.includes(p) && p !== cur ? 'is-dim' : ''}`}
                  style={{ height: p.h * u, fontSize: u, rotate: `${tilt(p.path)}deg` }}
                  onClick={() => {
                    if (t && n.tracePath) return onPick(n.tracePath, t);
                    const fake: TraceNode = { node: ['¬', '∧', '∨', '→', '↔'].includes(n.sym) ? 'and' : 'pred', value: val ?? false, kind: 'atomic', span: [0, 0], text: n.text, children: [] };
                    onPick(`a:${p.path}`, fake, explainUntraced(n, interpretation));
                  }}
                  initial={{ scale: 0.4, opacity: 0, y: -1.5 * u }} animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 16, delay: p.parent ? 0.45 : 0 }}>
                  <span className="ft-text">{n.sym}</span>
                  <span className="ft-meta">{n.meta}</span>
                  {/* sello V / F en la esquina de la nota (solo las partes evaluadas) */}
                  {val !== undefined && <span className="ft-stamp">{val ? 'V' : 'F'}</span>}
                </motion.button>
                {/* Nota de la parte que se explica: la subfórmula completa y la cuenta o la consulta al mundo */}
                {cur?.path === p.path && (
                  <motion.div className="ft-calc ft-note" style={{ fontSize: u }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <span className="ft-note-text">{n.text}</span>
                    {t?.kind === 'connective' && OP[t.node] && <span><Calc n={n} /></span>}
                    {t?.checked && <span className="ft-rule">{rule(t).rule}: {rule(t).tally} → <VF v={t.value} /></span>}
                    {l && <span className="ft-lookup">¿{l.q} = {l.set}? → <b className={l.yes ? 'is-true' : 'is-false'}>{l.yes ? 'sí' : 'no'}</b></span>}
                  </motion.div>
                )}
                {/* Casos probados: uno por elemento, en el nodo donde se calculan */}
                {withCases && (
                  <motion.div className="ft-cases" style={{ fontSize: u }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                    {shortCases(caseRows(n.cases!, interpretation)).map((c, i) => (
                      <motion.span key={c.el} data-gap={c.gap || undefined} className={`ft-check ${c.value ? 'is-true' : 'is-false'} ${c.decisive ? 'is-decisive' : ''}`}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.18 }}>
                        {c.gap > 0 && <i className="ft-gap">… {c.gap} casos más …</i>}
                        <b>{n.cases!.v} = {c.el}</b>
                        {c.ask ? <span>¿{c.ask.q}? {c.ask.yes ? 'sí' : 'no'}</span> : <span className="ft-case-text">{c.text}</span>}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
