import { useRef } from 'react';
import type { Language, Span } from '@contracts/types';

const CONNECTIVES = ['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')', ','];
const VARIABLES = ['x', 'y', 'z', 'w'];

/** Atajos ASCII que se convierten al símbolo al escribir. */
const SHORTCUTS: Array<[RegExp, string]> = [
  [/<->/g, '↔'],
  [/->/g, '→'],
  [/~/g, '¬'],
  [/&/g, '∧'],
  [/\|/g, '∨'],
  [/\\A/g, '∀'],
  [/\\E/g, '∃'],
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: Language;
  errorSpan?: Span;
}

/** Campo de fórmula + teclado de la máquina (requerimiento 5). Inserta en la posición del cursor. */
export function FormulaInput({ value, onChange, language, errorSpan }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const insert = (text: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const handleType = (raw: string) => {
    let v = raw;
    for (const [re, sym] of SHORTCUTS) v = v.replace(re, sym);
    onChange(v);
  };

  const symbols = [
    ...language.functions.map((f) => (f.arity === 0 ? f.name : `${f.name}(`)),
    ...language.predicates.map((p) => `${p.name}(`),
  ];

  return (
    <div className="formula-input">
      <input
        ref={ref}
        className="formula-field"
        value={value}
        onChange={(e) => handleType(e.target.value)}
        placeholder="∀x(P(x) → ∃y R(x,y))"
        spellCheck={false}
        aria-label="Fórmula"
        aria-invalid={!!errorSpan}
      />
      {errorSpan && (
        <div className="error-caret" aria-hidden="true">
          <span style={{ visibility: 'hidden' }}>{value.slice(0, errorSpan[0])}</span>
          <span className="caret-mark">{'^'.repeat(Math.max(1, errorSpan[1] - errorSpan[0]))}</span>
        </div>
      )}
      <div className="keyboard" role="group" aria-label="Teclado lógico">
        {CONNECTIVES.map((c) => (
          <button key={c} type="button" className="key key-logic" onClick={() => insert(c)}>{c}</button>
        ))}
        {VARIABLES.map((v) => (
          <button key={v} type="button" className="key" onClick={() => insert(v)}>{v}</button>
        ))}
        {symbols.map((s) => (
          <button key={s} type="button" className="key key-symbol" onClick={() => insert(s)}>{s}</button>
        ))}
        <button type="button" className="key key-wide" onClick={() => onChange(value.slice(0, -1))}>⌫</button>
      </div>
      <p className="hint">Teclado: ~ ¬ · &amp; ∧ · | ∨ · -&gt; → · &lt;-&gt; ↔ · \A ∀ · \E ∃</p>
    </div>
  );
}
