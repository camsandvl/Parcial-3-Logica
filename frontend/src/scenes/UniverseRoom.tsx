import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Element, Interpretation, SymbolDecl, ValidationError } from '@contracts/types';
import { api } from '../api';
import { OFFLINE_LINE, offline } from '../api/httpApi';
import { Character, characterImages, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { Tip } from '../components/vn/Tip';
import { FunctionDiagram } from '../components/vn/FunctionDiagram';
import { ConstantPicker } from '../components/vn/ConstantPicker';
import { PredicatePainter, RelationGraph } from '../components/vn/PredicateViews';
import { useMachine } from '../store/machine';
import { SceneInfo } from '../components/vn/SceneInfo';
import { preloadImages } from '../utils/preload';

/*
 * Escena 3 · Sala de Tarski (aula de Varsovia, 1933). El usuario construye la interpretación
 * un paso a la vez, guiado por Tarski (requerimiento 2):
 *   1. Dominio      → los elementos del mundo (D no vacío, sin repetidos)
 *   2. Un paso por función/constante → qué devuelve para cada tupla de Dⁿ (función total)
 *   3. Un paso por predicado         → en qué tuplas es verdadero (relación no vacía)
 *   4. Revisar      → resumen del mundo e "Instalar universo"
 * Layout de cuaderno: índice de pasos a la izquierda (✓ = completo) y el paso actual a la derecha.
 */

type StepKey = 'domain' | 'review' | `f:${string}` | `p:${string}`;
type Phase = 'intro' | 'build' | 'warn' | 'error' | 'example' | 'done';
interface Line { expression: Expression; text: string }

const INTRO: Line[] = [
  { expression: 'neutral', text: 'Soy Alfred Tarski. Gödel te dio los símbolos; yo te ayudaré a darles significado.' },
  { expression: 'talk', text: '«La nieve es blanca» es verdadera si y solo si la nieve es blanca. Una afirmación es verdadera cuando coincide con el mundo.' },
  { expression: 'talk', text: 'Así que construyamos ese mundo: un dominio, qué hace cada función y dónde se cumple cada predicado. Eso es una interpretación.' },
];
const DONE: Line = { expression: 'happy', text: 'Un mundo bien construido. Ahora vuelve con Turing a la consola: ahí escribirás la fórmula.' };
const EXAMPLE_LINE: Line = { expression: 'happy', text: 'Te armé un mundo de ejemplo con tres elementos. Puedes cambiarlo o instalarlo tal cual.' };

// El requerimiento solo pide un dominio finito y no vacío: no hay máximo de elementos.
const ELEMENT = /^[A-Za-z0-9_]{1,4}$/;

const BG = '/assets/scene3/bg-classroom.png';
const LEAVE_MS = 1100;

/** Todas las tuplas de Dⁿ, en orden lexicográfico según el orden de D. */
function tuples(domain: Element[], n: number): Element[][] {
  let acc: Element[][] = [[]];
  for (let i = 0; i < n; i++) acc = acc.flatMap((t) => domain.map((d) => [...t, d]));
  return acc;
}
const key = (t: Element[]) => t.join(',');
const sup = (n: number) => (n > 1 ? String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]) : '');

/** ¿Qué le falta a un símbolo para estar completo? (null = completo) */
function missing(sym: SymbolDecl, kind: 'f' | 'p', interp: Interpretation): string | null {
  const D = interp.domain;
  if (D.length === 0) return 'Primero necesitas al menos un elemento en el dominio.';
  if (kind === 'p') return (interp.predicates[sym.name] ?? []).length ? null : `Marca al menos una tupla donde ${sym.name} sea verdadero: una relación no puede estar vacía.`;
  const defined = new Set((interp.functions[sym.name] ?? []).map(([a]) => key(a)));
  const total = D.length ** sym.arity;
  const done = tuples(D, sym.arity).filter((t) => defined.has(key(t))).length;
  if (done === total) return null;
  return sym.arity === 0
    ? `Elige qué elemento del dominio nombra ${sym.name}.`
    : `A ${sym.name} le faltan ${total - done} de ${total} valores: una función debe estar definida para todos sus argumentos.`;
}

/** Interpretación de ejemplo, válida para cualquier lenguaje: D = {1, 2, 3}. */
function exampleInterpretation(functions: SymbolDecl[], predicates: SymbolDecl[]): Interpretation {
  const D = ['1', '2', '3'];
  const sum = (t: Element[]) => t.reduce((s, e) => s + Number(e), 0);
  return {
    domain: D,
    // f(x₁…xₙ) = (x₁ + … + xₙ) mod 3 + 1 ; una constante vale 1
    functions: Object.fromEntries(functions.map((f) => [f.name, tuples(D, f.arity).map((t) => [t, String((sum(t) % 3) + 1)] as [Element[], Element])])),
    // P(1), P(3)… ; R(x, y) cuando x < y ; aridad mayor: tuplas en orden creciente
    predicates: Object.fromEntries(predicates.map((p) => [p.name,
      p.arity === 1 ? [['1'], ['3']] : tuples(D, p.arity).filter((t) => t.every((e, i) => i === 0 || Number(t[i - 1]) < Number(e)))])),
  };
}

export function UniverseRoom() {
  const { language, interpretation: interp, setInterpretation, status, markReady, markError } = useMachine();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>(status.universe === 'ready' ? 'build' : 'intro');
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warn, setWarn] = useState('');
  const [step, setStep] = useState<StepKey>('domain');
  const [newElement, setNewElement] = useState('');

  // Mientras se lee esta escena, se descarga lo de la siguiente.
  useEffect(() => { preloadImages(characterImages('turing')); }, []);

  const D = interp.domain;
  const symbols: Array<{ step: StepKey; kind: 'f' | 'p'; sym: SymbolDecl }> = [
    ...language.functions.map((sym) => ({ step: `f:${sym.name}` as StepKey, kind: 'f' as const, sym })),
    ...language.predicates.map((sym) => ({ step: `p:${sym.name}` as StepKey, kind: 'p' as const, sym })),
  ];
  const steps: StepKey[] = ['domain', ...symbols.map((s) => s.step), 'review'];
  const index = steps.indexOf(step);
  const current = symbols.find((s) => s.step === step);

  const stepLine = (): Line => {
    if (step === 'domain') return { expression: 'talk', text: 'El dominio es el conjunto de todo lo que existe en tu mundo. Cuando una fórmula diga «para todo x», x recorrerá cada uno de estos elementos.' };
    if (step === 'review') return { expression: 'neutral', text: 'Este es tu mundo. Si todo está completo, instálalo en la máquina.' };
    const { sym, kind } = current!;
    if (kind === 'p' && sym.arity === 1) return { expression: 'talk', text: `Un predicado es una propiedad: ${sym.name} es el conjunto de elementos que la cumplen. Pinta los que la tienen; el resto no.` };
    if (kind === 'p' && sym.arity === 2) return { expression: 'talk', text: `Una relación conecta elementos: cada flecha x → y dice que ${sym.name}(x, y) es verdadero. ${sym.name} es el conjunto de esos pares.` };
    if (kind === 'p') return { expression: 'talk', text: `${sym.name} es el conjunto de tuplas donde es verdadero. Enciende esas tuplas; las demás serán falsas.` };
    if (sym.arity === 0) return { expression: 'talk', text: `Una constante es un nombre fijo: ${sym.name} señala siempre al mismo elemento del dominio. Cuélgale su etiqueta a ese elemento.` };
    return { expression: 'talk', text: `Una función es una regla: a cada entrada le corresponde exactamente un resultado. Por eso de cada entrada sale una sola flecha, y ninguna puede quedar sin ella.` };
  };
  const shown: Line =
    phase === 'intro' ? INTRO[line]
    : phase === 'done' ? DONE
    : phase === 'example' ? EXAMPLE_LINE
    : phase === 'warn' ? { expression: 'confused', text: warn }
    : phase === 'error' ? { expression: 'confused', text: offline(errors) ? OFFLINE_LINE : `Hmm… este mundo no está bien construido: ${errors[0]?.message}.` }
    : stepLine();

  const advanceDialog = () => {
    if (phase === 'intro') {
      if (line < INTRO.length - 1) setLine(line + 1);
      else setPhase('build');
    } else if (phase === 'done' && !leaving) {
      setLeaving(true);
      setTimeout(() => { markReady('universe'); navigate('/consola'); }, LEAVE_MS);
    }
  };

  const update = (next: Interpretation) => {
    setInterpretation(next);
    setErrors([]);
    if (phase !== 'intro') setPhase('build');
  };
  const go = (s: StepKey) => { setStep(s); if (phase !== 'intro' && phase !== 'done') setPhase('build'); };

  /** "Siguiente": si al paso le falta algo, Tarski lo dice en vez de avanzar. */
  const next = () => {
    const problem = step === 'domain'
      ? (D.length ? null : 'El dominio no puede estar vacío: un mundo necesita al menos un elemento.')
      : current ? missing(current.sym, current.kind, interp) : null;
    if (problem) { setWarn(problem); setPhase('warn'); return; }
    go(steps[index + 1]);
  };

  // ---- Dominio ----
  const elementProblem = (() => {
    const e = newElement.trim();
    if (!e) return null;
    if (!ELEMENT.test(e)) return 'Usa hasta 4 letras o números, sin espacios.';
    if (D.includes(e)) return `${e} ya está en el dominio.`;
    return null;
  })();
  const addElement = () => {
    const e = newElement.trim();
    if (!e || elementProblem) return;
    update({ ...interp, domain: [...D, e] });
    setNewElement('');
  };
  // Al quitar un elemento se borran las filas y tuplas que lo usaban.
  const removeElement = (e: Element) => {
    const prune = <T,>(rec: Record<string, T[]>, uses: (row: T) => boolean) =>
      Object.fromEntries(Object.entries(rec).map(([k, rows]) => [k, rows.filter((r) => !uses(r))]));
    update({
      domain: D.filter((d) => d !== e),
      functions: prune(interp.functions, ([args, v]) => v === e || args.includes(e)),
      predicates: prune(interp.predicates, (t) => t.includes(e)),
    });
  };

  // ---- Funciones ----
  const valueOf = (name: string, args: Element[]) => interp.functions[name]?.find(([a]) => key(a) === key(args))?.[1];
  const setValue = (name: string, args: Element[], value: Element) => {
    const rows = (interp.functions[name] ?? []).filter(([a]) => key(a) !== key(args));
    update({ ...interp, functions: { ...interp.functions, [name]: [...rows, [args, value]] } });
  };

  // ---- Predicados ----
  const holds = (name: string, t: Element[]) => (interp.predicates[name] ?? []).some((x) => key(x) === key(t));
  const toggle = (name: string, t: Element[]) => {
    const cur = interp.predicates[name] ?? [];
    const nextRows = holds(name, t) ? cur.filter((x) => key(x) !== key(t)) : [...cur, t];
    update({ ...interp, predicates: { ...interp.predicates, [name]: nextRows } });
  };

  const loadExample = () => {
    setInterpretation(exampleInterpretation(language.functions, language.predicates));
    setErrors([]);
    setStep('review');
    setPhase('example');
  };

  const install = async () => {
    const firstMissing = (D.length === 0 && 'El dominio no puede estar vacío.') ||
      symbols.map((s) => missing(s.sym, s.kind, interp)).find(Boolean);
    if (firstMissing) { setWarn(firstMissing); setPhase('warn'); return; }
    setBusy(true);
    const res = await api.validateInterpretation(language, interp);
    setBusy(false);
    if (res.ok) { setPhase('done'); return; }
    setErrors(res.errors);
    setPhase('error');
    markError('universe');
    // Lleva al paso donde está el primer error (path: "domain", "functions.f", "predicates.R[2]").
    const path = res.errors[0]?.path ?? '';
    const m = path.match(/^(functions|predicates)\.([^[]+)/);
    setStep(m ? (`${m[1] === 'functions' ? 'f' : 'p'}:${m[2]}` as StepKey) : 'domain');
  };

  const label = (s: StepKey) => (s === 'domain' ? 'Dominio' : s === 'review' ? 'Revisar' : s.slice(2));
  const errorPaths = new Set(errors.map((e) => e.path?.replace(/\[\d+\]$/, '')));
  const stepDone = (s: StepKey) => {
    if (s === 'domain') return D.length > 0;
    if (s === 'review') return false;
    const it = symbols.find((x) => x.step === s)!;
    return !missing(it.sym, it.kind, interp);
  };

  /** Título del paso actual (con globo que explica la notación). */
  const title = (() => {
    if (step === 'domain') return { text: 'Elementos del dominio D', tip: <><b>Dominio</b> · el conjunto de cosas que existen en tu mundo. Las variables x, y, z siempre toman valores de aquí.</> };
    if (step === 'review') return { text: 'Tu interpretación', tip: <><b>Interpretación</b> · el dominio más el significado de cada símbolo. Con ella, toda fórmula cerrada es verdadera o falsa.</> };
    const { sym, kind } = current!;
    if (kind === 'p') return { text: `${sym.name} ⊆ D${sup(sym.arity)}`, tip: <><b>⊆ «subconjunto de»</b> · {sym.name} es el conjunto de {sym.arity > 1 ? `${sym.arity}-tuplas` : 'elementos'} donde es verdadero.{sym.arity > 1 && <> D{sup(sym.arity)} son todas las {sym.arity}-tuplas de D: {D.length ** sym.arity} en total.</>}</> };
    if (sym.arity === 0) return { text: `${sym.name} ∈ D`, tip: <><b>∈ «pertenece a»</b> · {sym.name} nombra un elemento fijo del dominio.</> };
    return { text: `${sym.name} : D${sup(sym.arity)} → D`, tip: <><b>→ «va de… a…»</b> · {sym.name} lleva cada {sym.arity > 1 ? `${sym.arity}-tupla` : 'elemento'} de D a un elemento de D. Hay que definirla para las {D.length ** sym.arity} combinaciones.</> };
  })();

  return (
    <section className="vn-scene vn-scene-tarski" aria-label="Escena 3: Sala de Tarski">
      <SceneInfo place="Aula de Varsovia, 1933" fact="Estamos en un aula de Varsovia en el invierno de 1933 porque Tarski enseñó durante años en un liceo de esa ciudad, y ese año publicó su definición de verdad. La nieve que cae por la ventana es un guiño a su ejemplo: «La nieve es blanca» es verdadera si y solo si la nieve es blanca." />
      <div className="vn-stage">
        <img className="vn-bg" src={BG} alt="" draggable={false} />
      </div>

      {phase !== 'intro' && (
        /* Cuaderno: cabecera con acciones, índice a la izquierda y el paso actual a la derecha */
        <motion.div className="notebook" initial={{ y: '-6%', opacity: 0 }}
          animate={leaving ? { x: '40%', y: '-30%', scale: 0.35, rotate: 8, opacity: 0 } : { y: 0, opacity: 1 }}
          transition={leaving ? { duration: 0.8, ease: [0.5, 0, 0.75, 0] } : { type: 'spring', stiffness: 120, damping: 18 }}>

          <header className="nb-head">
            <h2>Tu mundo</h2>
            <div className="shelf-actions">
              <button type="button" className="btn-ghost btn-small" onClick={loadExample} disabled={phase === 'done'}>Usar ejemplo</button>
              <button type="button" className="btn-install" onClick={install} disabled={busy || phase === 'done'}>
                {busy ? 'Verificando…' : 'Instalar universo'}
              </button>
            </div>
          </header>

          <div className="nb-body">
            {/* Índice: cada entrada es un paso; ✓ = completo */}
            <nav className="nb-index" aria-label="Pasos">
              {steps.map((s) => {
                const it = symbols.find((x) => x.step === s);
                const bad = it && errorPaths.has(`${it.kind === 'f' ? 'functions' : 'predicates'}.${it.sym.name}`);
                const sub = s === 'domain' ? `{${D.join(', ')}}` : s === 'review' ? '' : it!.kind === 'p' ? 'predicado' : it!.sym.arity === 0 ? 'constante' : 'función';
                return (
                  <button key={s} type="button" onClick={() => go(s)}
                    className={`nb-tab ${s === step ? 'here' : ''} ${stepDone(s) ? 'ok' : ''} ${bad ? 'bad' : ''}`}>
                    <span className="nb-mark">{s === 'review' ? '★' : stepDone(s) ? '✓' : '○'}</span>
                    <span className="nb-name">{label(s)}</span>
                    {sub && <span className="nb-sub">{sub}</span>}
                  </button>
                );
              })}
            </nav>

            <div className="nb-page">
              {/* Título y navegación arriba: el diálogo de Tarski nunca los tapa */}
              <div className="nb-page-head">
                <Tip content={title.tip}>{(tp) => <span className="step-label has-tip" {...tp}>{title.text}</span>}</Tip>
                <div className="nb-nav">
                  {index > 0 && <button type="button" className="btn-ghost btn-small" onClick={() => go(steps[index - 1])}>Atrás</button>}
                  {step !== 'review' && <button type="button" className="btn-primary btn-small" onClick={next}>Siguiente</button>}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={step} className="nb-content"
                  initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0, pointerEvents: 'none' }} transition={{ duration: 0.18 }}>

                  {step === 'domain' && (
                    <>
                      {/* El dominio como un mundo: un óvalo dibujado a mano (como un diagrama de Venn)
                          con cada elemento como una bolita dentro. Así se ve que D es un conjunto. */}
                      <div className="domain-world" style={{ '--n': Math.max(1, D.length) } as CSSProperties}>
                        <Tip content={<><b>D</b> · el conjunto de cosas que existen en tu mundo. Las variables x, y, z siempre toman valores de aquí.</>}>
                          {(tp) => <span className="dw-label has-tip" {...tp}>D</span>}
                        </Tip>
                        <div className="dw-items">
                          <AnimatePresence>
                            {D.map((e, i) => (
                              <motion.span key={e} className="dw-dot" style={{ translate: `0 ${[0, -14, 8, -6, 12, -10][i % 6]}%` }}
                                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: [-4, 3, -2, 4, -3, 2][i % 6] }} exit={{ scale: 0 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 16 }}>
                                {e}
                                <button type="button" className="dw-remove" onClick={() => removeElement(e)} aria-label={`Quitar ${e}`}>×</button>
                              </motion.span>
                            ))}
                          </AnimatePresence>
                          {D.length === 0 && <span className="dw-empty">Tu mundo está vacío. Agrega su primer elemento abajo.</span>}
                        </div>
                      </div>
                      <form className="domain-add" onSubmit={(ev) => { ev.preventDefault(); addElement(); }}>
                        <input className="step-input" value={newElement} onChange={(ev) => setNewElement(ev.target.value)}
                          placeholder={String(D.length + 1)} maxLength={4} spellCheck={false} aria-label="Nuevo elemento" autoFocus />
                        <button type="submit" className="btn-ghost" disabled={!newElement.trim() || !!elementProblem}>Agregar</button>
                      </form>
                      <p className={`step-help ${elementProblem ? 'is-error' : ''}`}>
                        {elementProblem ?? 'Escribe un nombre (por ejemplo 1, 2, 3 o a, b) y pulsa Agregar.'}
                      </p>
                    </>
                  )}

                  {/* Funciones: diagrama de flechas (entradas → resultados en D) */}
                  {/* Constantes: etiqueta colgada de un elemento del mundo */}
                  {current?.kind === 'f' && current.sym.arity === 0 && (
                    <ConstantPicker
                      key={current.sym.name}
                      name={current.sym.name}
                      domain={D}
                      value={valueOf(current.sym.name, [])}
                      others={language.functions.filter((f) => f.arity === 0 && f.name !== current.sym.name).map((f) => ({ name: f.name, value: valueOf(f.name, []) }))}
                      onPick={(v) => setValue(current.sym.name, [], v)}
                    />
                  )}
                  {current?.kind === 'f' && current.sym.arity > 0 && (
                    <FunctionDiagram
                      key={current.sym.name}
                      name={current.sym.name}
                      inputs={tuples(D, current.sym.arity)}
                      domain={D}
                      valueOf={(args) => valueOf(current.sym.name, args)}
                      setValue={(args, v) => setValue(current.sym.name, args, v)}
                    />
                  )}
                  {/* Predicados: aridad 1 se pintan en el mundo, aridad 2 son flechas entre elementos,
                      aridad 3 o más una lista de tuplas que se encienden */}
                  {current?.kind === 'p' && current.sym.arity === 1 && (
                    <PredicatePainter key={current.sym.name} name={current.sym.name} domain={D}
                      holds={(x) => holds(current.sym.name, [x])} toggle={(x) => toggle(current.sym.name, [x])} />
                  )}
                  {current?.kind === 'p' && current.sym.arity === 2 && (
                    <RelationGraph key={current.sym.name} name={current.sym.name} domain={D}
                      holds={(tp) => holds(current.sym.name, tp)} toggle={(tp) => toggle(current.sym.name, tp)} />
                  )}
                  {current?.kind === 'p' && current.sym.arity > 2 && (() => {
                    const { sym } = current;
                    const count = (interp.predicates[sym.name] ?? []).length;
                    return (
                      <>
                        <p className="step-help">Enciende las tuplas donde {sym.name} es verdadero ({count} {count === 1 ? 'encendida' : 'encendidas'}). Las apagadas serán falsas.</p>
                        <div className="tuple-chips">
                          {tuples(D, sym.arity).map((tu) => {
                            const on = holds(sym.name, tu);
                            return (
                              <Tip key={key(tu)} content={<>{sym.name}({tu.join(', ')}) es <b>{on ? 'verdadero' : 'falso'}</b> · clic para cambiar</>}>
                                {(tp) => <button type="button" className={on ? 'on' : ''} onClick={() => toggle(sym.name, tu)} aria-pressed={on} {...tp}>{sym.name}({tu.join(', ')})</button>}
                              </Tip>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}

                  {step === 'review' && (
                    /* Hoja del mundo, escrita a mano */
                    <div className="world-sheet">
                      <p className="ws-line ws-domain">D = {'{'} {D.join(', ') || '∅'} {'}'}</p>
                      {symbols.map(({ kind, sym }) => {
                        const m = missing(sym, kind, interp);
                        let body: string;
                        if (kind === 'p') {
                          const ts = interp.predicates[sym.name] ?? [];
                          body = `${sym.name} = { ${ts.map((t) => (t.length > 1 ? `(${t.join(', ')})` : t[0])).join(', ')} }`;
                        } else if (sym.arity === 0) {
                          body = `${sym.name} = ${valueOf(sym.name, []) ?? '?'}`;
                        } else {
                          body = `${sym.name} : ${tuples(D, sym.arity).map((a) => `${a.length > 1 ? `(${a.join(',')})` : a[0]} ↦ ${valueOf(sym.name, a) ?? '?'}`).join(',  ')}`;
                        }
                        return (
                          <p key={sym.name} className={`ws-line ${m ? 'is-missing' : ''}`}>
                            <span className="ws-mark">{m ? '✗' : '✓'}</span> {body}
                            {m && <span className="ws-note">← falta completar</span>}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      <Character name="tarski" side="right" expression={shown.expression} leaving={leaving} talking={talking}
        beat={phase === 'intro' ? line : phase === 'build' ? 10 + index : phase === 'warn' ? 300 + warn.length : phase === 'error' ? 100 + errors.length : phase === 'example' ? 400 : 200} />

      <motion.div className="vn-dialog-wrap" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.4, delay: leaving ? 0.5 : 0 }}>
        <DialogBox speaker="Alfred Tarski" side="right" text={shown.text}
          canAdvance={phase === 'intro' || phase === 'done'} onAdvance={advanceDialog} onTypingChange={setTalking} />
      </motion.div>
    </section>
  );
}
