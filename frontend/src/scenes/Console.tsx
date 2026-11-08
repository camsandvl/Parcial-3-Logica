import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorList } from '../components/ErrorList';
import { FormulaInput } from '../components/FormulaInput';
import { Guide } from '../components/Guide';
import { useMachine } from '../store/machine';

export function Console() {
  const s = useMachine();
  const [step, setStep] = useState<'formula' | 'environment'>('formula');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const syntaxSpan = s.errors.find((e) => e.path === 'formula')?.span;

  const analyze = async () => {
    setBusy(true);
    const res = await api.parse(s.formula, s.language);
    setBusy(false);
    if (!res.ok) {
      s.setErrors(res.errors);
      s.markError('console');
      return;
    }
    s.setErrors([]);
    s.setFreeVars(res.freeVars);
    // Conserva solo asignaciones de variables que siguen libres.
    s.setEnvironment(Object.fromEntries(res.freeVars.filter((v) => s.environment[v]).map((v) => [v, s.environment[v]])));
    if (res.freeVars.length) setStep('environment');
    else await run({});
  };

  const run = async (environment = s.environment) => {
    setBusy(true);
    s.setResult(null);
    navigate('/informe');
    const res = await api.evaluate({ language: s.language, interpretation: s.interpretation, formula: s.formula, environment });
    setBusy(false);
    if (res.ok) {
      s.setResult(res);
      s.markReady('console');
    } else {
      s.setErrors(res.errors);
      s.markError('console');
      navigate('/consola');
    }
  };

  const missing = s.freeVars.filter((v) => !s.environment[v]);

  return (
    <section className="scene scene-processing">
      <h2>Escena 4 · Consola de instrucciones</h2>
      <Guide name="Turing">
        Escribe la proposición que quieres que la máquina decida. Si tiene variables libres, te pediré a qué
        elemento del universo apunta cada una.
      </Guide>

      <FormulaInput value={s.formula} onChange={(f) => { s.setFormula(f); setStep('formula'); }} language={s.language} errorSpan={syntaxSpan} />

      {step === 'environment' && (
        <fieldset className="panel">
          <legend>Entorno · variables libres</legend>
          {s.freeVars.map((v) => (
            <label key={v} className="row">
              {v} ↦
              <select value={s.environment[v] ?? ''} onChange={(e) => s.setEnvironment({ ...s.environment, [v]: e.target.value })}>
                <option value="">—</option>
                {s.interpretation.domain.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          ))}
        </fieldset>
      )}

      <ErrorList errors={s.errors} stages={['syntax', 'environment', 'semantics', 'interpretation']} />

      {step === 'formula' ? (
        <button className="primary" onClick={analyze} disabled={busy}>{busy ? 'Analizando…' : 'Analizar fórmula'}</button>
      ) : (
        <button className="primary" onClick={() => run()} disabled={busy || missing.length > 0}>
          {missing.length ? `Falta asignar: ${missing.join(', ')}` : 'Procesar'}
        </button>
      )}
    </section>
  );
}
