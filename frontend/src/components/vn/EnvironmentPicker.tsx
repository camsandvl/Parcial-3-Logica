import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Element, Environment } from '@contracts/types';

/** Color de la etiqueta de cada variable (se repite en la fórmula para relacionarlas). */
const COLORS: Record<string, string> = { x: '#ffd970', y: '#d9b8e6', z: '#a8dcc4', w: '#a9c4e6' };
const colorOf = (v: string) => COLORS[v.replace(/\d+$/, '')] ?? '#f3d79b';
const OFFSETS = [0, -14, 8, -6, 12, -10];

interface Props {
  formula: string;
  freeVars: string[];
  domain: Element[];
  environment: Environment;
  onChange: (env: Environment) => void;
}

/** Una variable está ligada en algún lugar si aparece tras ∀ o ∃ (entonces no se sustituye a ciegas). */
const boundSomewhere = (formula: string, v: string) => new RegExp(`[∀∃]\\s*${v}(?![0-9])`).test(formula);

/** Parte la fórmula en trozos, marcando cada aparición de una variable libre. */
function pieces(formula: string, freeVars: string[]) {
  const re = new RegExp(`\\b(${[...freeVars].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
  const out: Array<{ text: string; v?: string }> = [];
  let last = 0;
  for (const m of formula.matchAll(re)) {
    // no marcar la variable que sigue a un cuantificador (∀x): ahí está ligada
    if (/[∀∃]\s*$/.test(formula.slice(0, m.index))) continue;
    if (m.index! > last) out.push({ text: formula.slice(last, m.index) });
    out.push({ text: m[0], v: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < formula.length) out.push({ text: formula.slice(last) });
  return out;
}

/**
 * Entorno de las variables libres como etiquetas: reaparece el mundo D y cada variable es una
 * etiqueta de papel que se cuelga del elemento al que señala (como las constantes con Tarski).
 */
export function EnvironmentPicker({ formula, freeVars, domain, environment, onChange }: Props) {
  const firstMissing = freeVars.find((v) => !environment[v]);
  const [active, setActive] = useState<string>(firstMissing ?? freeVars[0]);
  const parts = pieces(formula, freeVars);

  const pick = (e: Element) => {
    const next = { ...environment, [active]: e };
    onChange(next);
    // pasa sola a la siguiente variable sin elemento
    const nextVar = freeVars.find((v) => v !== active && !next[v]);
    if (nextVar) setActive(nextVar);
  };

  return (
    <div className="envp">
      {/* La fórmula con sus variables libres marcadas en el color de su etiqueta */}
      <p className="envp-formula">
        {parts.map((p, i) => p.v
          ? <mark key={i} className="envp-var" style={{ '--tag': colorOf(p.v) } as CSSProperties}>{p.text}</mark>
          : <span key={i}>{p.text}</span>)}
      </p>

      <div className="envp-tabs" role="radiogroup" aria-label="Variable a asignar">
        <span>Elige a quién señala:</span>
        {freeVars.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={active === v}
            className={`envp-tab ${active === v ? 'on' : ''} ${environment[v] ? 'done' : ''}`}
            style={{ '--tag': colorOf(v) } as CSSProperties} onClick={() => setActive(v)}>
            {v}{environment[v] ? ` = ${environment[v]}` : ''}
          </button>
        ))}
      </div>

      <div className="domain-world cp-world envp-world" style={{ '--n': Math.max(1, domain.length) } as CSSProperties}>
        <span className="dw-label">D</span>
        <div className="dw-items">
          {domain.map((e, i) => {
            const tags = freeVars.filter((v) => environment[v] === e);
            return (
              <div key={e} className="cp-slot" style={{ translate: `0 ${OFFSETS[i % 6]}%` }}>
                <button type="button" className={`dw-dot cp-dot ${environment[active] === e ? 'is-chosen' : ''}`} onClick={() => pick(e)}
                  aria-label={`${active} señala a ${e}`}>
                  {e}
                </button>
                <div className="cp-tags">
                  {tags.map((v) => (
                    <motion.span key={v} className="cp-tag is-mine envp-tag" style={{ '--tag': colorOf(v) } as CSSProperties}
                      initial={{ y: -10, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
                      {v}
                    </motion.span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cómo se leerá la fórmula con los valores elegidos */}
      <p className="fd-reading">
        Se leerá: <code>{parts.map((p) => (p.v && environment[p.v] && !boundSomewhere(formula, p.v) ? environment[p.v] : p.text)).join('')}</code>
      </p>
    </div>
  );
}
