import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ValidationError } from '@contracts/types';
import { api } from '../api';
import { OFFLINE_LINE, offline } from '../api/httpApi';
import { Character, characterImages, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { SymbolTile, type SymbolKind } from '../components/vn/SymbolTile';
import { useMachine } from '../store/machine';
import { SceneInfo } from '../components/vn/SceneInfo';
import { preloadImages } from '../utils/preload';

/*
 * Escena 2: el usuario declara el lenguaje fabricando un símbolo a la vez,
 * en pasos cortos guiados por Gödel (una sola pregunta en pantalla):
 *   1. Tipo     → función, constante o predicado
 *   2. Nombre   → con validación inmediata
 *   3. Aridad   → solo funciones y predicados (la constante es aridad 0)
 *   4. Revisar  → vista previa de la ficha y "Fabricar"
 * Las fichas fabricadas se guardan en el estante de arriba.
 */

type Choice = 'function' | 'constant' | 'predicate';
type Step = 'type' | 'name' | 'arity' | 'confirm' | 'next';
type Phase = 'intro' | 'build' | 'error' | 'warn' | 'example' | 'done';

interface Line { expression: Expression; text: string }

const INTRO: Line[] = [
  { expression: 'neutral', text: 'Soy Kurt Gödel. Antes de hablar de verdad, necesitamos un lenguaje: los símbolos con los que escribirás.' },
  { expression: 'talk', text: 'Fabricaremos los símbolos uno por uno. Cada ficha lleva grabado su número de Gödel: un código único. Viejas costumbres.' },
];

const STEP_LINES: Record<Step, Line> = {
  type: { expression: 'talk', text: '¿Qué quieres fabricar? Las funciones devuelven un elemento; los predicados afirman algo, verdadero o falso.' },
  name: { expression: 'neutral', text: 'Ponle un nombre. Una letra basta.' },
  arity: { expression: 'talk', text: '¿Cuántos argumentos recibe? Esa es su aridad: cada círculo de arriba de la ficha es un argumento.' },
  confirm: { expression: 'neutral', text: 'Revisa la ficha. Si está bien, fabrícala.' },
  next: { expression: 'happy', text: '¡Ficha lista! ¿Fabricamos otra o instalamos el lenguaje?' },
};
/** En el paso de revisar, Gödel explica qué significa cada pieza de la ficha según su tipo. */
const CONFIRM_LINES: Record<Choice, Line> = {
  function: { expression: 'talk', text: 'Los círculos de arriba son sus argumentos; la flecha es su salida: devuelve un elemento, f : Dⁿ → D.' },
  constant: { expression: 'talk', text: 'Sin círculos: no recibe argumentos. Solo tiene la flecha de salida, porque nombra un elemento fijo, c ∈ D.' },
  predicate: { expression: 'talk', text: 'Los círculos de arriba son sus argumentos; el foco se enciende si lo que afirma es verdadero, P ⊆ Dⁿ.' },
};
const DONE: Line = { expression: 'happy', text: 'Un lenguaje impecable. Ahora Tarski le dará significado a cada símbolo.' };
/** Si intenta instalar sin predicados, Gödel lo detiene y explica por qué. */
const NO_PREDICATE: Line = { expression: 'confused', text: 'Espera: te falta al menos un predicado. Sin ellos no hay nada que pueda ser verdadero o falso. Fabrica uno, como P(x).' };
const EXAMPLE_LINE: Line = { expression: 'happy', text: 'Te dejé un lenguaje clásico en el estante: f, la constante c, P y R. Puedes cambiarlo o instalarlo tal cual.' };

/** Lenguaje de ejemplo para la demo: una función, una constante y dos predicados. */
const EXAMPLE_LANGUAGE = {
  functions: [{ name: 'f', arity: 1 }, { name: 'c', arity: 0 }],
  predicates: [{ name: 'P', arity: 1 }, { name: 'R', arity: 2 }],
};
const LEAVE_MS = 1100; // duración de la salida hacia la Sala de Tarski

const CHOICES: Array<{ id: Choice; title: string; desc: string; example: string }> = [
  { id: 'function', title: 'Función', desc: 'Recibe argumentos y devuelve un elemento del dominio.', example: 'f(x)' },
  { id: 'constant', title: 'Constante', desc: 'Un elemento fijo del dominio. No recibe argumentos.', example: 'c' },
  { id: 'predicate', title: 'Predicado', desc: 'Afirma algo sobre sus argumentos: es verdadero o falso.', example: 'P(x)' },
];

const MAX_ARITY = 4; // más argumentos harían tablas de interpretación inmanejables en pantalla
const VARS = ['x', 'y', 'z', 'w'];
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const VARIABLE = /^[xyzw]\d*$/;

const BG = '/assets/scene2/bg-workshop.png';
const BG_FALLBACK = '/assets/scene1/bg-lab.png'; // mientras llega el fondo del taller

const kindOf = (c: Choice): SymbolKind => (c === 'predicate' ? 'predicates' : 'functions');

export function LanguageWorkshop() {
  const { language, setLanguage, status, markReady, markError } = useMachine();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>(status.language === 'ready' ? 'build' : 'intro');
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Mientras se trabaja aquí, se descarga la escena de Tarski.
  useEffect(() => { preloadImages([...characterImages('tarski'), '/assets/scene3/bg-classroom.png']); }, []);
  const [bg, setBg] = useState(BG);

  // Ficha en fabricación
  const [step, setStep] = useState<Step>('type');
  const [choice, setChoice] = useState<Choice>('predicate');
  const [name, setName] = useState('');
  const [arity, setArity] = useState(1);

  const kind = kindOf(choice);
  const draftArity = choice === 'constant' ? 0 : arity;
  const steps: Step[] = choice === 'constant' ? ['type', 'name', 'confirm'] : ['type', 'name', 'arity', 'confirm'];
  const stepIndex = steps.indexOf(step);

  const allNames = [...language.functions, ...language.predicates].map((s) => s.name);
  const trimmed = name.trim();
  const nameProblem =
    !trimmed ? null
    : !NAME.test(trimmed) ? 'Debe empezar con una letra y usar solo letras, números o _.'
    : VARIABLE.test(trimmed) ? 'x, y, z y w están reservadas para las variables.'
    : allNames.includes(trimmed) ? `Ya existe un símbolo llamado ${trimmed}.`
    : null;

  const current: Line =
    phase === 'intro' ? INTRO[line]
    : phase === 'done' ? DONE
    : phase === 'error' ? { expression: 'confused', text: errorLine(errors) }
    : phase === 'warn' ? NO_PREDICATE
    : phase === 'example' ? EXAMPLE_LINE
    : step === 'confirm' ? CONFIRM_LINES[choice]
    : STEP_LINES[step];

  const advanceDialog = () => {
    if (phase === 'intro') {
      if (line < INTRO.length - 1) setLine(line + 1);
      else setPhase('build');
    } else if (phase === 'done' && !leaving) {
      // Salida animada: las fichas se archivan, Gödel se despide y se pasa a Tarski.
      setLeaving(true);
      setTimeout(() => {
        markReady('language');
        navigate('/universo');
      }, LEAVE_MS);
    }
  };

  const changeLanguage = (next: typeof language) => {
    setLanguage(next);
    setErrors([]);
    if (phase !== 'intro') setPhase('build');
  };

  const go = (s: Step) => {
    setStep(s);
    if (phase === 'error' || phase === 'warn' || phase === 'example') setPhase('build');
  };

  /** Carga un lenguaje listo (útil en la demo) y Gödel lo anuncia. */
  const loadExample = () => {
    setLanguage(EXAMPLE_LANGUAGE);
    setErrors([]);
    setStep('next');
    setPhase('example');
  };
  const back = () => go(steps[Math.max(0, stepIndex - 1)]);
  const forward = () => go(steps[stepIndex + 1]);

  const pick = (c: Choice) => {
    setChoice(c);
    setArity(1); // cada ficha nueva empieza en aridad 1
    go('name');
  };

  const fabricate = () => {
    changeLanguage({ ...language, [kind]: [...language[kind], { name: trimmed, arity: draftArity }] });
    setName('');
    setStep('next');
  };

  const remove = (k: SymbolKind, i: number) =>
    changeLanguage({ ...language, [k]: language[k].filter((_, j) => j !== i) });

  const install = async () => {
    // Sin predicados no hay fórmulas posibles: Gödel lo dice en vez de un botón gris.
    if (language.predicates.length === 0) {
      setPhase('warn');
      return;
    }
    setBusy(true);
    const res = await api.validateLanguage(language);
    setBusy(false);
    if (res.ok) setPhase('done');
    else {
      setErrors(res.errors);
      setPhase('error');
      markError('language');
    }
  };

  const errorFor = (k: SymbolKind, i: number) => errors.find((e) => e.path === `language.${k}[${i}]`)?.message;
  const total = language.functions.length + language.predicates.length;
  const example = choice === 'constant' ? trimmed || 'c' : `${trimmed || '?'}(${VARS.slice(0, arity).join(', ')})`;

  const preview = (
    <SymbolTile kind={kind} symbol={{ name: trimmed, arity: draftArity }} position={language[kind].length + 1} size="lg" />
  );

  return (
    <section className="vn-scene vn-scene-godel" aria-label="Escena 2: Taller de Gödel">
      <SceneInfo place="Biblioteca de archivo" fact="Estamos en una biblioteca de archivo, con muros de cajoncitos de fichas, porque Gödel hizo algo parecido con la lógica: le dio un número a cada símbolo y fórmula para «catalogarlos», como cada libro tiene su ficha en uno de esos cajones. Con esa idea demostró en 1931 sus teoremas de incompletitud." />
      <div className="vn-stage">
        <img className={`vn-bg ${bg === BG_FALLBACK ? 'is-placeholder' : ''}`} src={bg} alt="" draggable={false} onError={() => setBg(BG_FALLBACK)} />
      </div>

      {phase !== 'intro' && (
        <>
          {/* Estante: todo lo fabricado hasta ahora */}
          <motion.div className="shelf" initial={{ y: '-30%', opacity: 0 }}
            // Al salir, el estante "vuela" hacia los archiveros del fondo.
            animate={leaving ? { x: '55%', y: '-40%', scale: 0.35, rotate: 8, opacity: 0 } : { y: 0, opacity: 1 }}
            transition={leaving ? { duration: 0.8, ease: [0.5, 0, 0.75, 0] } : undefined}>
            <div className="shelf-head">
              <h2>Tus símbolos <span>({total})</span></h2>
              <div className="shelf-actions">
                <button type="button" className="btn-ghost btn-small" onClick={loadExample} disabled={phase === 'done'}>Usar ejemplo</button>
                <button type="button" className="btn-install" onClick={install} disabled={busy || total === 0 || phase === 'done'}>
                  {busy ? 'Verificando…' : 'Instalar lenguaje'}
                </button>
              </div>
            </div>
            <div className="shelf-tiles">
              <AnimatePresence>
                {(['functions', 'predicates'] as const).flatMap((k) =>
                  language[k].map((s, i) => (
                    <SymbolTile key={`${k}-${s.name}-${i}`} kind={k} symbol={s} position={i + 1} size="sm" error={errorFor(k, i)} onRemove={() => remove(k, i)} />
                  )),
                )}
              </AnimatePresence>
              {total === 0 && <p className="shelf-empty">Aún no hay fichas. Fabrica la primera abajo.</p>}
            </div>
          </motion.div>

          {/* Tarjeta de pasos: una sola pregunta a la vez */}
          <motion.div className="step-card" initial={{ y: '10%', opacity: 0 }}
            animate={leaving ? { y: '25%', opacity: 0 } : { y: 0, opacity: 1 }}
            transition={leaving ? { duration: 0.45, ease: 'easeIn' } : { delay: 0.1 }}>
            {step !== 'next' && (
              <ol className="step-progress" aria-label="Pasos">
                {steps.map((s, i) => (
                  <li key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>
                    {s === 'type' ? 'Tipo' : s === 'name' ? 'Nombre' : s === 'arity' ? 'Aridad' : 'Revisar'}
                  </li>
                ))}
              </ol>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={step} className="step-body"
                initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0, pointerEvents: 'none' }} transition={{ duration: 0.2 }}>

                {step === 'type' && (
                  <div className="choice-grid">
                    {CHOICES.map((c) => (
                      <button key={c.id} type="button" className={`choice choice-${c.id}`} onClick={() => pick(c.id)}>
                        <span className="choice-title">{c.title}</span>
                        <span className="choice-example">{c.example}</span>
                        <span className="choice-desc">{c.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 'name' && (
                  <form className="step-row" onSubmit={(e) => { e.preventDefault(); if (trimmed && !nameProblem) forward(); }}>
                    <div className="step-main">
                      <label className="step-label" htmlFor="symbol-name">Nombre {choice === 'function' ? 'de la función' : choice === 'constant' ? 'de la constante' : 'del predicado'}</label>
                      <input id="symbol-name" className="step-input" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder={choice === 'predicate' ? 'P' : choice === 'constant' ? 'c' : 'f'} maxLength={12} spellCheck={false} autoFocus />
                      <p className={`step-help ${nameProblem ? 'is-error' : ''}`}>{nameProblem ?? 'Ejemplos: ' + (choice === 'predicate' ? 'P, R, Mayor' : choice === 'constant' ? 'c, cero, a' : 'f, g, suma')}</p>
                      <div className="step-actions">
                        <button type="button" className="btn-ghost" onClick={back}>Atrás</button>
                        <button type="submit" className="btn-primary" disabled={!trimmed || !!nameProblem}>Siguiente</button>
                      </div>
                    </div>
                    <div className="step-preview">{preview}</div>
                  </form>
                )}

                {step === 'arity' && (
                  <div className="step-row">
                    <div className="step-main">
                      <span className="step-label">¿Cuántos argumentos recibe {trimmed}?</span>
                      <div className="arity-chips" role="radiogroup">
                        {Array.from({ length: MAX_ARITY }, (_, i) => i + 1).map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={arity === n} className={arity === n ? 'on' : ''} onClick={() => setArity(n)}>{n}</button>
                        ))}
                      </div>
                      <p className="step-help">Se escribirá así: <code>{example}</code></p>
                      <div className="step-actions">
                        <button type="button" className="btn-ghost" onClick={back}>Atrás</button>
                        <button type="button" className="btn-primary" onClick={forward}>Siguiente</button>
                      </div>
                    </div>
                    <div className="step-preview">{preview}</div>
                  </div>
                )}

                {step === 'confirm' && (
                  <div className="step-row">
                    <div className="step-main">
                      <span className="step-label">Tu ficha</span>
                      <p className="step-summary">{summary(choice, trimmed, draftArity)}</p>
                      <p className="step-help">Se escribirá así: <code>{example}</code></p>
                      <div className="step-actions">
                        <button type="button" className="btn-ghost" onClick={back}>Atrás</button>
                        <button type="button" className="btn-primary" onClick={fabricate}>Fabricar</button>
                      </div>
                    </div>
                    <div className="step-preview">{preview}</div>
                  </div>
                )}

                {step === 'next' && (
                  <div className="step-next">
                    <span className="step-label">Ficha guardada en el estante.</span>
                    <div className="step-actions">
                      <button type="button" className="btn-ghost" onClick={() => go('type')}>Fabricar otro símbolo</button>
                      <button type="button" className="btn-install" onClick={install} disabled={busy || phase === 'done'}>
                        {busy ? 'Verificando…' : 'Instalar lenguaje'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <Character name="godel" side="right" expression={current.expression} leaving={leaving}
        beat={phase === 'intro' ? line : phase === 'build' ? 10 + steps.indexOf(step) + (step === 'next' ? 20 : 0) : phase === 'error' ? 100 + errors.length : phase === 'warn' ? 300 : phase === 'example' ? 400 : 200}
        talking={talking} />

      <motion.div className="vn-dialog-wrap" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.4, delay: leaving ? 0.5 : 0 }}>
      <DialogBox speaker="Kurt Gödel" side="right" text={current.text}
        canAdvance={phase === 'intro' || phase === 'done'} onAdvance={advanceDialog} onTypingChange={setTalking} />
      </motion.div>
    </section>
  );
}

function summary(choice: Choice, name: string, arity: number) {
  if (choice === 'constant') return `Una constante llamada ${name}: nombrará un elemento fijo del dominio.`;
  const args = `${arity} argumento${arity > 1 ? 's' : ''}`;
  if (choice === 'function') return `Una función llamada ${name} que recibe ${args} y devuelve un elemento del dominio.`;
  return `Un predicado llamado ${name} que recibe ${args} y será verdadero o falso.`;
}

function errorLine(errors: ValidationError[]) {
  if (errors.length === 0) return '';
  if (offline(errors)) return OFFLINE_LINE;
  const more = errors.length > 1 ? ` (y ${errors.length - 1} problema${errors.length > 2 ? 's' : ''} más, marcados en el estante)` : '';
  return `Hmm… este lenguaje no está bien formado: ${errors[0].message}.${more}`;
}
