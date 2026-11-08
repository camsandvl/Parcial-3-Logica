import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Element } from '@contracts/types';
import { api } from '../api';
import { ErrorList } from '../components/ErrorList';
import { Guide } from '../components/Guide';
import { useMachine } from '../store/machine';

/** Todas las tuplas de D^n, en orden lexicográfico. */
function tuples(domain: Element[], n: number): Element[][] {
  let acc: Element[][] = [[]];
  for (let i = 0; i < n; i++) acc = acc.flatMap((t) => domain.map((d) => [...t, d]));
  return acc;
}

const MAX_ROWS = 256; // por encima de esto la tabla se vuelve inmanejable en pantalla

export function UniverseRoom() {
  const { language, interpretation, setInterpretation, errors, setErrors, markReady, markError } = useMachine();
  const [newElement, setNewElement] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const D = interpretation.domain;

  const addElement = () => {
    const e = newElement.trim();
    if (!e) return;
    setInterpretation({ ...interpretation, domain: [...D, e] });
    setNewElement('');
  };
  // Al quitar un elemento se borran las filas y tuplas que lo usaban.
  const removeElement = (e: Element) => {
    const prune = <T,>(rec: Record<string, T[]>, uses: (row: T) => boolean) =>
      Object.fromEntries(Object.entries(rec).map(([k, rows]) => [k, rows.filter((r) => !uses(r))]));
    setInterpretation({
      domain: D.filter((d) => d !== e),
      functions: prune(interpretation.functions, ([args, v]) => v === e || args.includes(e)),
      predicates: prune(interpretation.predicates, (t) => t.includes(e)),
    });
  };

  const setFunctionValue = (name: string, args: Element[], value: Element) => {
    const key = args.join(',');
    const rows = (interpretation.functions[name] ?? []).filter(([a]) => a.join(',') !== key);
    setInterpretation({ ...interpretation, functions: { ...interpretation.functions, [name]: value ? [...rows, [args, value]] : rows } });
  };
  const functionValue = (name: string, args: Element[]) =>
    interpretation.functions[name]?.find(([a]) => a.join(',') === args.join(','))?.[1] ?? '';

  const toggleTuple = (name: string, t: Element[]) => {
    const current = interpretation.predicates[name] ?? [];
    const key = t.join(',');
    const has = current.some((x) => x.join(',') === key);
    const next = has ? current.filter((x) => x.join(',') !== key) : [...current, t];
    setInterpretation({ ...interpretation, predicates: { ...interpretation.predicates, [name]: next } });
  };
  const inRelation = (name: string, t: Element[]) =>
    (interpretation.predicates[name] ?? []).some((x) => x.join(',') === t.join(','));

  const submit = async () => {
    setBusy(true);
    const res = await api.validateInterpretation(language, interpretation);
    setBusy(false);
    if (res.ok) {
      markReady('universe');
      navigate('/consola');
    } else {
      setErrors(res.errors);
      markError('universe');
    }
  };

  return (
    <section className="scene scene-engine">
      <h2>Escena 3 · Sala de máquinas de Tarski</h2>
      <Guide name="Tarski">
        Un símbolo no significa nada hasta que lo interpretamos. Construye un universo finito y dime qué hace
        cada función y en qué tuplas se cumple cada predicado.
      </Guide>

      <fieldset className="panel">
        <legend>Dominio D</legend>
        <div className="chips">
          {D.map((e) => (
            <span className="chip" key={e}>
              {e} <button type="button" className="ghost" onClick={() => removeElement(e)} aria-label={`Quitar ${e}`}>✕</button>
            </span>
          ))}
          <input
            value={newElement}
            onChange={(e) => setNewElement(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addElement()}
            placeholder="nuevo elemento + Enter"
            aria-label="Nuevo elemento del dominio"
          />
        </div>
      </fieldset>

      {D.length > 0 && language.functions.map((f) => {
        const rows = tuples(D, f.arity);
        return (
          <fieldset className="panel" key={f.name}>
            <legend>{f.name}<sup>I</sup> : D<sup>{f.arity}</sup> → D</legend>
            {rows.length > MAX_ROWS ? <p>Demasiadas filas ({rows.length}) para mostrar.</p> : (
              <table className="machine-table">
                <tbody>
                  {rows.map((args) => (
                    <tr key={args.join(',')}>
                      <td>{f.name}({args.join(', ')})</td>
                      <td>
                        <select value={functionValue(f.name, args)} onChange={(e) => setFunctionValue(f.name, args, e.target.value)} aria-label={`Valor de ${f.name}(${args.join(', ')})`}>
                          <option value="">—</option>
                          {D.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </fieldset>
        );
      })}

      {D.length > 0 && language.predicates.map((p) => {
        const rows = tuples(D, p.arity);
        return (
          <fieldset className="panel" key={p.name}>
            <legend>{p.name}<sup>I</sup> ⊆ D<sup>{p.arity}</sup></legend>
            {rows.length > MAX_ROWS ? <p>Demasiadas tuplas ({rows.length}) para mostrar.</p> : (
              <div className="tuple-grid">
                {rows.map((t) => (
                  <label key={t.join(',')} className={`tuple ${inRelation(p.name, t) ? 'on' : ''}`}>
                    <input type="checkbox" checked={inRelation(p.name, t)} onChange={() => toggleTuple(p.name, t)} />
                    ({t.join(', ')})
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}

      <ErrorList errors={errors} stages={['interpretation']} />
      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? 'Verificando…' : 'Construir universo'}
      </button>
    </section>
  );
}
