import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ValidationError } from '@contracts/types';
import { api } from '../api';
import { Character, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { SymbolTile, type SymbolKind } from '../components/vn/SymbolTile';
import { useMachine } from '../store/machine';

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
type Phase = 'intro' | 'build' | 'error' | 'done';

interface Line { expression: Expression; text: string }

const INTRO: Line[] = [
  { expression: 'neutral', text: 'Soy Kurt Gödel. Antes de hablar de verdad, necesitamos un lenguaje: los símbolos con los que escribirás.' },
  { expression: 'talk', text: 'Fabricaremos los símbolos uno por uno. Cada ficha lleva grabado su número de Gödel: un código único. Viejas costumbres.' },
];

const STEP_LINES: Record<Step, Line> = {
  type: { expression: 'talk', text: '¿Qué quieres fabricar? Las funciones devuelven un elemento; los predicados afirman algo, verdadero o falso.' },
  name: { expression: 'neutral', text: 'Ponle un nombre. Una letra basta.' },
  arity: { expression: 'talk', text: '¿Cuántos argumentos recibe? Esa es su aridad: cada argumento es una entrada de la ficha.' },
  confirm: { expression: 'neutral', text: 'Revisa la ficha. Si está bien, fabrícala.' },
  next: { expression: 'happy', text: '¡Ficha lista! ¿Fabricamos otra o instalamos el lenguaje?' },
};
const DONE: Line = { expression: 'happy', text: 'Un lenguaje impecable. Ahora Tarski le dará significado a cada símbolo.' };

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
    : STEP_LINES[step];

  const advanceDialog = () => {
    if (phase === 'intro') {
      if (line < INTRO.length - 1) setLine(line + 1);
      else setPhase('build');
    } else if (phase === 'done') {
      markReady('language');
      navigate('/universo');
    }
  };

  const changeLanguage = (next: typeof language) => {
    setLanguage(next);
    setErrors([]);
    if (phase === 'error' || phase === 'done') setPhase('build');
  };

  const go = (s: Step) => {
    setStep(s);
    if (phase === 'error') setPhase('build');
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
  const noPredicates = language.predicates.length === 0;
  const total = language.functions.length + language.predicates.length;
  const example = choice === 'constant' ? trimmed || 'c' : `${trimmed || '?'}(${VARS.slice(0, arity).join(', ')})`;

  const preview = (
    <SymbolTile kind={kind} symbol={{ name: trimmed, arity: draftArity }} position={language[kind].length + 1} size="lg" />
  );

  return (
    <section className="vn-scene vn-scene-godel" aria-label="Escena 2: Taller de Gödel">
      <div className="vn-stage">
        <img className={`vn-bg ${bg === BG_FALLBACK ? 'is-placeholder' : ''}`} src={bg} alt="" draggable={false} onError={() => setBg(BG_FALLBACK)} />
      </div>

      {phase !== 'intro' && (
        <>
          {/* Estante: todo lo fabricado hasta ahora */}
          <motion.div className="shelf" initial={{ y: '-30%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="shelf-head">
              <h2>Tus símbolos <span>({total})</span></h2>
              <button type="button" className="btn-install" onClick={install} disabled={busy || noPredicates || phase === 'done'}
                title={noPredicates ? 'Necesitas al menos un predicado' : undefined}>
                {busy ? 'Verificando…' : 'Instalar lenguaje'}
              </button>
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
          <motion.div className="step-card" initial={{ y: '10%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
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
                      <button type="button" className="btn-primary" onClick={() => go('type')}>Fabricar otro símbolo</button>
                      <button type="button" className="btn-install" onClick={install} disabled={busy || noPredicates || phase === 'done'}>
                        {busy ? 'Verificando…' : 'Instalar lenguaje'}
                      </button>
                    </div>
                    {noPredicates && <p className="step-help">Para instalar necesitas al menos un predicado: sin ellos no se puede escribir ninguna fórmula.</p>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <Character name="godel" side="right" expression={current.expression}
        beat={phase === 'intro' ? line : phase === 'build' ? 10 + steps.indexOf(step) + (step === 'next' ? 20 : 0) : phase === 'error' ? 100 + errors.length : 200}
        talking={talking} />

      <DialogBox speaker="Kurt Gödel" side="right" text={current.text}
        canAdvance={phase === 'intro' || phase === 'done'} onAdvance={advanceDialog} onTypingChange={setTalking} />
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
  const more = errors.length > 1 ? ` (y ${errors.length - 1} problema${errors.length > 2 ? 's' : ''} más, marcados en el estante)` : '';
  return `Hmm… este lenguaje no está bien formado: ${errors[0].message}.${more}`;
}
