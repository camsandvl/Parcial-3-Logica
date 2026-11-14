import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Language } from '@contracts/types';
import { api } from '../api';
import { OFFLINE_LINE, offline } from '../api/httpApi';
import { Character, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { Tip } from '../components/vn/Tip';
import { EnvironmentPicker } from '../components/vn/EnvironmentPicker';
import { useMachine } from '../store/machine';
import { SceneInfo } from '../components/vn/SceneInfo';

/*
 * Escena 4 · Consola. Turing vuelve a su laboratorio y el usuario escribe la fórmula
 * (requerimientos 3, 4 y 5): teclado de la máquina dibujado a mano (y teclado físico),
 * la fórmula se "imprime" en una cinta de papel, el error de sintaxis se marca en su
 * posición exacta y, si hay variables libres, se le asigna a cada una un elemento de D.
 */

type Phase = 'intro' | 'write' | 'error' | 'env' | 'leaving';
interface Line { expression: Expression; text: string }

const INTRO: Line[] = [
  { expression: 'happy', text: '¡Volviste! Con el lenguaje de Gödel y el mundo de Tarski, la máquina ya sabe leer… y sabe qué significa lo que lee.' },
  { expression: 'talk', text: 'Ahora dale una instrucción: una fórmula. La imprimiré en la cinta y la evaluaré en tu mundo.' },
];
const WRITE: Line = { expression: 'talk', text: 'Escribe con las teclas de la máquina o con tu teclado. Pasa el mouse por una tecla para ver qué significa. Cuando esté lista, analízala.' };
const LEAVE_MS = 1100;

/** Atajos del teclado físico que se convierten al símbolo al escribir. */
const SHORTCUTS: Array<[RegExp, string]> = [
  [/<->/g, '↔'], [/->/g, '→'], [/~/g, '¬'], [/&/g, '∧'], [/\|/g, '∨'], [/\\A/g, '∀'], [/\\E/g, '∃'],
];

interface Key { text: string; insert?: string; name: string; help: string }
const CONNECTIVES: Key[] = [
  { text: '¬', name: 'no', help: '¬A es verdadera cuando A es falsa' },
  { text: '∧', name: 'y', help: 'A ∧ B es verdadera cuando las dos lo son' },
  { text: '∨', name: 'o', help: 'A ∨ B es verdadera cuando al menos una lo es' },
  { text: '→', name: 'entonces', help: 'A → B: «si A, entonces B». Solo es falsa cuando A es verdadera y B falsa' },
  { text: '↔', name: 'si y solo si', help: 'A ↔ B es verdadera cuando A y B tienen el mismo valor' },
];
const QUANTIFIERS: Key[] = [
  { text: '∀', name: 'para todo', help: '∀x A: A se cumple para todos los elementos del dominio' },
  { text: '∃', name: 'existe', help: '∃x A: A se cumple para al menos un elemento del dominio' },
];
const VARIABLES: Key[] = ['x', 'y', 'z', 'w'].map((v) => ({ text: v, name: 'variable', help: `${v} representa un elemento cualquiera del dominio` }));
const MARKS: Key[] = [
  { text: '(', name: 'abre', help: 'Agrupa una parte de la fórmula' },
  { text: ')', name: 'cierra', help: 'Cierra lo que abriste' },
  { text: ',', name: 'coma', help: 'Separa los argumentos: R(x, y)' },
];

function symbolKeys(language: Language): Key[] {
  return [
    ...language.functions.map((f) => f.arity === 0
      ? { text: f.name, name: 'constante', help: `${f.name} nombra un elemento fijo del dominio` }
      : { text: `${f.name}(`, insert: `${f.name}(`, name: 'función', help: `${f.name} recibe ${f.arity} ${f.arity === 1 ? 'argumento' : 'argumentos'} y devuelve un elemento` }),
    ...language.predicates.map((p) => ({ text: `${p.name}(`, insert: `${p.name}(`, name: 'predicado', help: `${p.name} recibe ${p.arity} ${p.arity === 1 ? 'argumento' : 'argumentos'} y es verdadero o falso` })),
  ];
}

/** Una fórmula de ejemplo que usa el lenguaje construido con Gödel. */
function exampleFormula(language: Language): string {
  const un = language.predicates.find((p) => p.arity === 1);
  const bin = language.predicates.find((p) => p.arity === 2);
  if (un && bin) return `∀x(${un.name}(x) → ∃y ${bin.name}(x, y))`;
  if (bin) return `∀x ∃y ${bin.name}(x, y)`;
  if (un) return `∃x ${un.name}(x)`;
  const p = language.predicates[0];
  return p ? `∃x ${p.name}(${Array(p.arity).fill('x').join(', ')})` : '';
}

export function Console() {
  const s = useMachine();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>(s.status.console === 'ready' || s.status.console === 'error' ? 'write' : 'intro');
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const syntaxError = s.errors.find((e) => e.stage === 'syntax' || e.path === 'formula');
  const D = s.interpretation.domain;
  const missing = s.freeVars.filter((v) => !s.environment[v]);

  // Si se vuelve del informe con un error, Turing lo explica.
  useEffect(() => { if (syntaxError && phase === 'write') setPhase('error'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown: Line =
    phase === 'intro' ? INTRO[line]
    : phase === 'error' && offline(s.errors) ? { expression: 'confused', text: OFFLINE_LINE }
    : phase === 'error' ? { expression: 'confused', text: `Hmm, no puedo leer eso: ${syntaxError?.message ?? s.errors[0]?.message ?? 'algo no está bien escrito'}. Lo marqué en la cinta.` }
    : phase === 'env' ? { expression: 'talk', text: `Tu fórmula tiene ${s.freeVars.length === 1 ? 'una variable libre' : 'variables libres'} (${s.freeVars.join(', ')}): ningún cuantificador dice de qué elemento hablan. Dime a cuál señala cada una.` }
    : phase === 'leaving' ? { expression: 'happy', text: '¡Allá vamos! Veamos qué dice la máquina.' }
    : WRITE;

  const advance = () => {
    if (phase !== 'intro') return;
    if (line < INTRO.length - 1) setLine(line + 1);
    else setPhase('write');
  };

  const setFormula = (f: string) => {
    s.setFormula(f);
    if (s.errors.length) s.setErrors([]);
    if (phase === 'error' || phase === 'env') setPhase('write');
  };

  /** Inserta en la posición del cursor de la cinta. */
  const insert = (raw: string) => {
    const el = input.current;
    const v = s.formula;
    const start = el?.selectionStart ?? v.length;
    const end = el?.selectionEnd ?? v.length;
    // Espaciado automático para que la cinta se lea bien: los conectivos binarios llevan
    // espacios, y un símbolo o cuantificador que sigue a una letra o a ")" se separa con uno.
    const before = v.slice(0, start);
    let text = raw;
    if (['∧', '∨', '→', '↔'].includes(raw)) text = `${/\s$/.test(before) || !before ? '' : ' '}${raw} `;
    else if (/^[A-Za-z∀∃¬(]/.test(raw) && /[A-Za-z0-9)]$/.test(before) && !/^[xyzw]\d*$/.test(raw.replace('(', '')) ) text = ` ${raw}`;
    else if (/^[A-Za-z]/.test(raw) && /[∀∃][xyzw]\d*$/.test(before)) text = ` ${raw}`;
    setFormula(v.slice(0, start) + text + v.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  };
  const backspace = () => {
    const el = input.current;
    const v = s.formula;
    const start = el?.selectionStart ?? v.length;
    const end = el?.selectionEnd ?? v.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setFormula(v.slice(0, from) + v.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(from, from); });
  };
  const typed = (raw: string) => {
    let v = raw;
    for (const [re, sym] of SHORTCUTS) v = v.replace(re, sym);
    setFormula(v);
  };

  const analyze = async () => {
    if (!s.formula.trim()) { s.setErrors([{ code: 'SYNTAX_ERROR', stage: 'syntax', message: 'la cinta está vacía', span: [0, 0], path: 'formula' }]); setPhase('error'); return; }
    setBusy(true);
    const res = await api.parse(s.formula, s.language);
    setBusy(false);
    if (!res.ok) {
      s.setErrors(res.errors);
      s.markError('console');
      setPhase('error');
      return;
    }
    s.setErrors([]);
    s.setFreeVars(res.freeVars);
    // Conserva solo asignaciones de variables que siguen libres.
    s.setEnvironment(Object.fromEntries(res.freeVars.filter((v) => s.environment[v]).map((v) => [v, s.environment[v]])));
    if (res.freeVars.length) setPhase('env');
    else processNow();
  };

  /** Salida animada y luego la evaluación (el informe muestra el procesamiento). */
  const processNow = () => {
    setPhase('leaving');
    setTimeout(async () => {
      s.setResult(null);
      navigate('/informe');
      const res = await api.evaluate({ language: s.language, interpretation: s.interpretation, formula: s.formula, environment: s.environment });
      if (res.ok) {
        s.setResult(res);
        s.markReady('console');
      } else {
        s.setErrors(res.errors);
        s.markError('console');
        navigate('/consola');
      }
    }, LEAVE_MS);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void analyze(); }
  };

  const leaving = phase === 'leaving';
  // Teclado de máquina de escribir: tres filas escalonadas y centradas
  const rows: Key[][][] = [
    [CONNECTIVES, QUANTIFIERS],
    [VARIABLES, symbolKeys(s.language)],
    [MARKS],
  ];
  const keyButton = (k: Key) => (
    <Tip key={k.text} content={<><b>{k.text.replace('(', '')}</b> · {k.name} · {k.help}</>}>
      {(tp) => (
        <button type="button" className="tkey" onClick={() => insert(k.insert ?? k.text)} aria-label={`${k.text} (${k.name})`} {...tp}>
          <span className="tkey-sym">{k.text}</span>
          <span className="tkey-name">{k.name}</span>
        </button>
      )}
    </Tip>
  );

  return (
    <section className="vn-scene vn-scene-turing vn-scene-console" aria-label="Escena 4: Consola">
      <SceneInfo place="Hut 8, Bletchley Park" fact="Estamos en el Hut 8 de Bletchley Park porque ahí Turing dirigió al equipo que descifraba los mensajes navales cifrados con Enigma. Las cabañas eran de madera sencilla, con las cortinas cerradas por la guerra, y la máquina de escribir del escritorio era la herramienta de cada día, como el teclado con el que escribes tu fórmula." />
      <div className="vn-stage">
        <img className="vn-bg" src="/assets/scene5/bg-hut8.png" alt="" draggable={false} />
      </div>

      {phase !== 'intro' && (
        <motion.div className="console-card" initial={{ y: '-6%', opacity: 0 }}
          animate={leaving ? { x: '-30%', y: '-25%', scale: 0.4, rotate: -8, opacity: 0 } : { y: 0, opacity: 1 }}
          transition={leaving ? { duration: 0.8, ease: [0.5, 0, 0.75, 0] } : { type: 'spring', stiffness: 120, damping: 18 }}>

          <header className="nb-head">
            <h2>Instrucción</h2>
            <div className="shelf-actions">
              <button type="button" className="btn-ghost btn-small" onClick={() => setFormula(exampleFormula(s.language))} disabled={leaving}>Usar ejemplo</button>
            </div>
          </header>

          <div className="console-body">
            {/* La cinta: la fórmula se imprime en una tira de papel perforada */}
            <div className={`tape ${syntaxError ? 'has-error' : ''}`} hidden={phase === 'env'} onClick={() => input.current?.focus()}>
              <input ref={input} className="tape-input" value={s.formula} onChange={(e) => typed(e.target.value)} onKeyDown={onKey}
                placeholder="∀x(P(x) → ∃y R(x, y))" spellCheck={false} aria-label="Fórmula" aria-invalid={!!syntaxError} autoFocus disabled={leaving} />
              {syntaxError?.span && (
                <div className="tape-caret" aria-hidden="true">
                  <span style={{ visibility: 'hidden' }}>{s.formula.slice(0, syntaxError.span[0])}</span>
                  <span className="tape-caret-mark">{'^'.repeat(Math.max(1, syntaxError.span[1] - syntaxError.span[0]))}</span>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {phase === 'env' ? (
                /* Entorno: a qué elemento de D señala cada variable libre */
                <motion.div key="env" className="env" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <EnvironmentPicker formula={s.formula} freeVars={s.freeVars} domain={D} environment={s.environment} onChange={s.setEnvironment} />
                  <button type="button" className="btn-ghost btn-small env-back" onClick={() => setPhase('write')}>Editar la fórmula</button>
                </motion.div>
              ) : (
                /* Teclado de la máquina: cada tecla con su nombre en palabras */
                <motion.div key="keys" className="typewriter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {rows.map((groups, i) => (
                    <div key={i} className={`tw-row tw-row-${i}`}>
                      {groups.filter((g) => g.length).map((g, j) => (
                        <div key={j} className="tw-group">{g.map(keyButton)}</div>
                      ))}
                      {i === 2 && (
                        <div className="tw-group">
                          <button type="button" className="tkey tkey-wide" onClick={backspace}><span className="tkey-sym">⌫</span><span className="tkey-name">borrar</span></button>
                          <button type="button" className="tkey tkey-wide" onClick={() => setFormula('')}><span className="tkey-sym">✕</span><span className="tkey-name">limpiar</span></button>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="console-go">
              {phase === 'env'
                ? <button type="button" className="btn-install btn-go" onClick={processNow} disabled={missing.length > 0}>
                    {missing.length ? `Falta asignar: ${missing.join(', ')}` : 'Procesar'}
                  </button>
                : <button type="button" className="btn-install btn-go" onClick={() => void analyze()} disabled={busy || leaving}>{busy ? 'Leyendo…' : 'Analizar'}</button>}
            </div>
          </div>
        </motion.div>
      )}

      <Character name="turing" expression={shown.expression} beat={phase === 'intro' ? line : phase === 'error' ? 100 + s.errors.length : phase === 'env' ? 200 : phase === 'leaving' ? 300 : 10}
        talking={talking} leaving={leaving} side="right" />

      <motion.div className="vn-dialog-wrap" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.4, delay: leaving ? 0.5 : 0 }}>
        <DialogBox speaker="Alan Turing" side="right" text={shown.text} canAdvance={phase === 'intro'} onAdvance={advance} onTypingChange={setTalking} />
      </motion.div>
    </section>
  );
}
