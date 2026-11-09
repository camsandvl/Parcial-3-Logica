// Backend simulado: permite trabajar el frontend sin Emily ni Ale.
// Valida lo básico para poder probar los estados de error de la interfaz;
// la evaluación devuelve fixtures de contracts/.
import type { HistoryEntry, ValidationError } from '@contracts/types';
import counterexample from '@contracts/fixtures/result-counterexample.json';
import witness from '@contracts/fixtures/result-witness.json';
import type { EvaluateResponse, ParseResponse } from '@contracts/types';
import type { MachineApi } from './types';

const delay = <T,>(value: T, ms = 400) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const result = (errors: ValidationError[]) => (errors.length ? { ok: false as const, errors } : { ok: true as const });

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const VARIABLE = /^[xyzw]\d*$/;

const history: HistoryEntry[] = [];

/** Detección ingenua de variables libres (el parser real es de Emily). */
function naiveFreeVars(formula: string): string[] {
  const bound = new Set<string>();
  for (const m of formula.matchAll(/[∀∃]\s*([xyzw]\d*)/g)) bound.add(m[1]);
  const free = new Set<string>();
  for (const m of formula.matchAll(/\b([xyzw]\d*)\b/g)) if (!bound.has(m[1])) free.add(m[1]);
  return [...free].sort();
}

export const mockApi: MachineApi = {
  async validateLanguage(language) {
    const errors: ValidationError[] = [];
    const seen = new Set<string>();
    // path por posición (REPARTO.md §3.5): "language.functions[1]", "language.predicates[0]".
    const all = [
      ...language.functions.map((s, i) => ({ ...s, kind: 'functions' as const, i })),
      ...language.predicates.map((s, i) => ({ ...s, kind: 'predicates' as const, i })),
    ];
    for (const s of all) {
      const path = `language.${s.kind}[${s.i}]`;
      if (!NAME.test(s.name))
        errors.push({ code: 'INVALID_LANGUAGE', stage: 'language', message: `"${s.name}" no es un nombre válido: debe empezar con letra`, path });
      else if (VARIABLE.test(s.name))
        errors.push({ code: 'INVALID_LANGUAGE', stage: 'language', message: `"${s.name}" parece una variable (x, y, z, w); usa otro nombre`, path });
      if (seen.has(s.name))
        errors.push({ code: 'INVALID_LANGUAGE', stage: 'language', message: `"${s.name}" está repetido`, path });
      seen.add(s.name);
      const min = s.kind === 'predicates' ? 1 : 0;
      if (!Number.isInteger(s.arity) || s.arity < min)
        errors.push({ code: 'INVALID_LANGUAGE', stage: 'language', message: `La aridad de ${s.name} debe ser un entero ≥ ${min}`, path });
    }
    return delay(result(errors));
  },

  async validateInterpretation(language, interp) {
    const errors: ValidationError[] = [];
    const D = new Set(interp.domain);
    if (interp.domain.length === 0)
      errors.push({ code: 'EMPTY_DOMAIN', stage: 'interpretation', message: 'El dominio no puede estar vacío', path: 'domain' });
    if (D.size !== interp.domain.length)
      errors.push({ code: 'DUPLICATE_ELEMENT', stage: 'interpretation', message: 'El dominio tiene elementos repetidos', path: 'domain' });

    for (const f of language.functions) {
      const rows = interp.functions[f.name] ?? [];
      const expected = D.size ** f.arity;
      const keys = new Set(rows.map(([args]) => args.join(',')));
      if (keys.size < expected)
        errors.push({ code: 'FUNCTION_INCOMPLETE', stage: 'interpretation', message: `${f.name} está definida en ${keys.size} de ${expected} tuplas`, path: `functions.${f.name}` });
      for (const [, v] of rows)
        if (!D.has(v))
          errors.push({ code: 'FUNCTION_VALUE_OUT_OF_DOMAIN', stage: 'interpretation', message: `${f.name} toma el valor "${v}", que no está en D`, path: `functions.${f.name}` });
    }
    for (const p of language.predicates) {
      const tuples = interp.predicates[p.name] ?? [];
      if (tuples.length === 0)
        errors.push({ code: 'EMPTY_RELATION', stage: 'interpretation', message: `La relación ${p.name} no puede estar vacía`, path: `predicates.${p.name}` });
      tuples.forEach((t, i) => {
        if (t.length !== p.arity)
          errors.push({ code: 'TUPLE_WRONG_ARITY', stage: 'interpretation', message: `${p.name} tiene una tupla de tamaño ${t.length}, se esperaba ${p.arity}`, path: `predicates.${p.name}[${i}]` });
        else if (t.some((e) => !D.has(e)))
          errors.push({ code: 'TUPLE_OUT_OF_DOMAIN', stage: 'interpretation', message: `(${t.join(', ')}) usa elementos fuera de D`, path: `predicates.${p.name}[${i}]` });
      });
    }
    return delay(result(errors));
  },

  async parse(formula) {
    if (!formula.trim())
      return delay<ParseResponse>({ ok: false, errors: [{ code: 'SYNTAX_ERROR', stage: 'syntax', message: 'La fórmula está vacía', span: [0, 0], path: 'formula' }] });
    let depth = 0;
    for (let i = 0; i < formula.length; i++) {
      if (formula[i] === '(') depth++;
      if (formula[i] === ')' && --depth < 0)
        return delay<ParseResponse>({ ok: false, errors: [{ code: 'SYNTAX_ERROR', stage: 'syntax', message: 'Paréntesis de cierre sin abrir', span: [i, i + 1], path: 'formula' }] });
    }
    if (depth > 0)
      return delay<ParseResponse>({ ok: false, errors: [{ code: 'SYNTAX_ERROR', stage: 'syntax', message: 'Falta cerrar un paréntesis', span: [formula.length, formula.length], path: 'formula' }] });
    // AST de relleno: el real lo produce el parser de Emily.
    return delay<ParseResponse>({
      ok: true,
      ast: { type: 'pred', name: 'P', args: [], span: [0, formula.length] },
      freeVars: naiveFreeVars(formula),
    });
  },

  async evaluate(req) {
    const res = (req.formula.includes('∃') && !req.formula.includes('∀') ? witness : counterexample) as unknown as EvaluateResponse;
    if (res.ok)
      history.unshift({ id: history.length + 1, createdAt: new Date().toISOString(), formula: req.formula, value: res.value, summary: res.summary });
    return delay(res, 900);
  },

  async history() {
    return delay([...history], 150);
  },
};
