import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { TraceNode } from '@contracts/types';
import { Character, type CharacterName, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { Machine } from '../components/vn/Machine';
import { FormulaTree } from '../components/vn/FormulaTree';
import { useMachine } from '../store/machine';
import { SceneInfo } from '../components/vn/SceneInfo';

/*
 * Escenas 5 y 6 · Procesamiento e informe. Turing, Gödel y Tarski se reúnen en el
 * laboratorio. Mientras la máquina evalúa se anima la nota de Turing; después aparece el
 * veredicto (VERDADERO / FALSO) y la fórmula se dibuja como un árbol brillante, parte por
 * parte: con cada línea de diálogo aparece una parte y Gödel (conectivos) o Tarski
 * (cuantificadores y átomos) explica por qué es verdadera o falsa.
 */

const SWAP_MS = 950;       // lo que tarda un personaje en salir antes de que entre el siguiente
const MIN_PROCESS_MS = 2600; // la animación de la máquina se ve completa aunque el backend sea rápido


const NAMES: Record<CharacterName, string> = { turing: 'Alan Turing', godel: 'Kurt Gödel', tarski: 'Alfred Tarski' };

interface Line { who: CharacterName; expression: Expression; text: string }

const vf = (v: boolean) => (v ? 'verdadero' : 'falso');
const assignment = (d?: Record<string, string>) => (d ? Object.entries(d).map(([k, v]) => `${k} = ${v}`).join(', ') : '');

/** Explicación en palabras de por qué un nodo tiene su valor. */
function explain(n: TraceNode): string {
  const checked = n.checked?.length ?? 0;
  switch (n.kind) {
    case 'witness':
      return `Basta con un elemento que la cumpla: el testigo es ${assignment(n.decisive)}. Por eso este «existe» es verdadero.`;
    case 'counterexample':
      return `Un solo caso en contra tumba un «para todo»: el contraejemplo es ${assignment(n.decisive)}. Por eso es falso.`;
    case 'full_check':
      return n.value
        ? `Se cumple para cada elemento del dominio: se revisaron los ${checked} y ninguno falló.`
        : `Ningún elemento del dominio la cumple: se revisaron los ${checked} y todos dieron falso.`;
    case 'atomic':
      return `Se consulta directamente mi interpretación: ${n.text} ${n.value ? 'está' : 'no está'} entre los casos donde el predicado es verdadero.`;
    default: {
      const [a, b] = n.children;
      switch (n.node) {
        case 'not': return `«No» invierte el valor: lo de adentro es ${vf(!n.value)}, así que esto es ${vf(n.value)}.`;
        case 'and': return n.value ? 'Una «y» es verdadera cuando las dos partes lo son, y aquí lo son.' : 'Una «y» es falsa en cuanto una de sus partes es falsa: la marcada abajo lo es.';
        case 'or': return n.value ? 'Una «o» es verdadera en cuanto una de sus partes lo es: la marcada abajo lo es.' : 'Una «o» es falsa solo cuando las dos partes son falsas, y aquí lo son.';
        case 'implies': return n.value
          ? (a && !a.value ? 'Si la primera parte es falsa, el «si… entonces» es verdadero (no se rompe ninguna promesa).' : 'La segunda parte es verdadera, así que el «si… entonces» se cumple.')
          : 'Un «si… entonces» solo es falso cuando la primera parte es verdadera y la segunda falsa. Eso pasa aquí.';
        case 'iff': return `Un «si y solo si» es verdadero cuando las dos partes valen lo mismo: aquí ${a && b ? `son ${vf(a.value)} y ${vf(b.value)}` : 'se compararon'}.`;
        default: return `Su valor es ${vf(n.value)}.`;
      }
    }
  }
}


interface Step { path: string; node: TraceNode }

/** Recorrido en preorden: primero la fórmula completa, luego cada parte de izquierda a derecha. */
function preorder(n: TraceNode, path = 'r'): Step[] {
  return [{ path, node: n }, ...n.children.flatMap((c, i) => preorder(c, `${path}.${i}`))];
}

/** Quién explica cada parte: Tarski los cuantificadores y átomos (el mundo), Gödel los conectivos. */
const roleOf = (n: TraceNode): CharacterName => (['forall', 'exists', 'pred'].includes(n.node) ? 'tarski' : 'godel');

export function Report() {
  const { result, formula, ast, interpretation, environment } = useMachine();
  const navigate = useNavigate();
  const [minDone, setMinDone] = useState(false);
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const [picked, setPicked] = useState<(Step & { text?: string }) | null>(null); // parte elegida con clic al final

  useEffect(() => { const id = setTimeout(() => setMinDone(true), MIN_PROCESS_MS); return () => clearTimeout(id); }, []);

  const done = minDone && !!result?.ok;
  const root = result?.ok ? result.trace : null;
  const value = result?.ok ? result.value : false;
  const steps = useMemo(() => (root ? preorder(root) : []), [root]);

  // Guion: presentación, una línea por cada parte del árbol (que se revela al llegar a ella) y cierre.
  const lines: Line[] = useMemo(() => {
    if (!root || !result?.ok) return [];
    return [
      { who: 'turing', expression: value ? 'happy' : 'neutral', text: `¡La máquina terminó! Tu fórmula es ${value ? 'VERDADERA' : 'FALSA'}. Veamos por qué, parte por parte.` },
      ...steps.map(({ node }) => ({ who: roleOf(node), expression: 'talk' as Expression, text: `${node.text} es ${vf(node.value)}. ${explain(node)}` })),
      { who: 'turing', expression: 'happy', text: '¡Lo conseguimos! Ahora podemos volver al salón y resolver el examen explicando cómo se construye y se comprueba una fórmula. Haz clic en cualquier parte del árbol para repasarla, o prueba otra fórmula.' },
    ];
  }, [root, result, value, steps]);

  const finished = done && line >= lines.length - 1;
  const revealed = done ? Math.min(line, steps.length) : 0;
  const shown = new Set(steps.slice(0, revealed).map((s) => s.path));
  const currentPath = picked?.path ?? (done && line >= 1 && line <= steps.length ? steps[line - 1].path : null);

  const current: Line = !done
    ? { who: 'turing', expression: 'talk', text: 'La máquina está leyendo tu fórmula… lee, escribe y cambia de estado.' }
    : picked ? { who: roleOf(picked.node), expression: 'talk', text: picked.text ?? `${picked.node.text} es ${vf(picked.node.value)}. ${explain(picked.node)}` }
    : lines[line];

  const who = current.who;

  // La fórmula nunca se parte en dos líneas: si es larga, la nota se achica hasta caber entre el
  // sello y el borde derecho de la columna (los botones quedan afuera, a la derecha).
  // (el encabezado aparece después de que sale la animación de «procesando»: se mide al montarse)
  const [head, setHead] = useState<HTMLElement | null>(null);
  const formulaRef = useRef<HTMLElement>(null);
  const [formulaFit, setFormulaFit] = useState({ scale: 1, wrap: false, max: 0 });
  useLayoutEffect(() => {
    const el = formulaRef.current;
    if (!head || !el) return;
    const fit = () => {
      const stamp = head.querySelector('.stamp') as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(head).columnGap) || 0;
      const avail = head.clientWidth - (stamp?.offsetWidth ?? 0) - gap;
      // ancho natural en una línea (se mide sin cortes y a tamaño completo)
      const prev = { ws: el.style.whiteSpace, fs: el.style.fontSize, mw: el.style.maxWidth };
      el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none'; el.style.fontSize = '';
      const natural = el.scrollWidth;
      Object.assign(el.style, { whiteSpace: prev.ws, fontSize: prev.fs, maxWidth: prev.mw });
      const ratio = avail / natural;
      // Hasta el 60 % se achica en una línea; si aun así no cabe (fórmulas muy largas), pasa a dos líneas
      setFormulaFit(ratio >= 0.6 ? { scale: Math.min(1, ratio), wrap: false, max: 0 } : { scale: 0.6, wrap: true, max: avail });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(head);
    return () => ro.disconnect();
  }, [head, formula]);

  // Un personaje a la vez: cuando cambia quien habla, el actual sale y luego entra el otro.
  const [stage, setStage] = useState<{ who: CharacterName; leaving: boolean }>({ who, leaving: false });
  useEffect(() => {
    if (who === stage.who) return;
    setStage((st) => ({ ...st, leaving: true }));
    const id = setTimeout(() => setStage({ who, leaving: false }), SWAP_MS);
    return () => clearTimeout(id);
  }, [who, stage.who]);

  return (
    <section className="vn-scene vn-scene-report" aria-label="Informe">
      <SceneInfo place="Regreso al salón de clases" fact="El portal nos devuelve al examen. La fórmula ya fue analizada y evaluada: ahora podemos defender la respuesta explicando el lenguaje, la interpretación, los testigos y los contraejemplos." />
      <div className="vn-stage">
        <img className="vn-bg" src="/assets/scene4/bg-lecture-hall.png" alt="" draggable={false} />
      </div>

      {/* Sin tarjeta: la nota y luego el árbol flotan sobre el laboratorio */}
      <div className="report-area">
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div key="proc" className="report-processing" exit={{ opacity: 0, scale: 0.9 }}>
              <Machine on screenText="PROCESANDO" />
            </motion.div>
          ) : (
            <motion.div key="res" className="report-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <header className="report-head" ref={setHead}>
                <code className="report-formula" ref={formulaRef} style={{ fontSize: `calc(${1.9 * formulaFit.scale} * var(--u))`, ...(formulaFit.wrap ? { whiteSpace: 'normal', maxWidth: formulaFit.max, flex: '1 1 auto' } : {}) }}>{formula}</code>
                <motion.span className={`stamp ${value ? 'is-true' : 'is-false'}`}
                  initial={{ scale: 2.4, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: -6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.15 }}>
                  {value ? 'VERDADERO' : 'FALSO'}
                </motion.span>
                {finished && (
                  <motion.div className="report-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <button type="button" className="btn-ghost btn-small" onClick={() => navigate('/universo')}>Cambiar el mundo</button>
                    <button type="button" className="btn-install" onClick={() => navigate('/consola')}>Probar otra fórmula</button>
                    <button type="button" className="btn-install" onClick={() => navigate('/examen')}>Volver al examen</button>
                  </motion.div>
                )}
              </header>

              <div className="report-tree">
                {root && revealed > 0 && (
                  <FormulaTree ast={ast} root={root} shown={shown} current={currentPath} overview={finished} interpretation={interpretation} environment={environment}
                    onPick={(path, node, text) => { if (finished) setPicked(picked?.path === path ? null : { path, node, text }); }} />
                )}
                {finished && picked && (
                  <button type="button" className="ft-all btn-ghost btn-small" onClick={() => setPicked(null)}>Ver todo el árbol</button>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Un solo personaje en escena: el que habla (entra deslizándose y sale al cambiar de turno) */}
      <Character key={stage.who} name={stage.who} side="right" className={`rp-${stage.who}`} leaving={stage.leaving}
        expression={stage.who === who ? current.expression : 'neutral'} beat={line} talking={stage.who === who && talking} />

      <DialogBox speaker={NAMES[who]} side="right" tone={who} text={current.text}
        canAdvance={done && !finished && !picked} onAdvance={() => setLine((l) => Math.min(l + 1, lines.length - 1))} onTypingChange={setTalking} />

    </section>
  );
}
