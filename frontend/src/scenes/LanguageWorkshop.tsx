import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SymbolDecl } from '@contracts/types';
import { api } from '../api';
import { ErrorList } from '../components/ErrorList';
import { Guide } from '../components/Guide';
import { useMachine } from '../store/machine';

type Kind = 'functions' | 'predicates';

function SymbolTable({ kind, items, onChange }: { kind: Kind; items: SymbolDecl[]; onChange: (s: SymbolDecl[]) => void }) {
  const update = (i: number, patch: Partial<SymbolDecl>) =>
    onChange(items.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <fieldset className="panel">
      <legend>{kind === 'functions' ? 'Símbolos funcionales (aridad 0 = constante)' : 'Predicados'}</legend>
      {items.map((s, i) => (
        <div className="row" key={i}>
          <input aria-label="Nombre" value={s.name} onChange={(e) => update(i, { name: e.target.value.trim() })} placeholder={kind === 'functions' ? 'f' : 'P'} />
          <label>
            aridad
            <input type="number" min={kind === 'functions' ? 0 : 1} value={s.arity} onChange={(e) => update(i, { arity: Number(e.target.value) })} />
          </label>
          <button type="button" className="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { name: '', arity: kind === 'functions' ? 0 : 1 }])}>
        + Agregar
      </button>
    </fieldset>
  );
}

export function LanguageWorkshop() {
  const { language, setLanguage, errors, setErrors, markReady, markError } = useMachine();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async () => {
    setBusy(true);
    const res = await api.validateLanguage(language);
    setBusy(false);
    if (res.ok) {
      markReady('language');
      navigate('/universo');
    } else {
      setErrors(res.errors);
      markError('language');
    }
  };

  return (
    <section className="scene scene-lab">
      <h2>Escena 2 · Taller de Gödel</h2>
      <Guide name="Gödel">
        Todo razonamiento empieza por sus símbolos. Dime qué funciones y predicados existen, y cuántos
        argumentos recibe cada uno.
      </Guide>
      <div className="two-col">
        <SymbolTable kind="functions" items={language.functions} onChange={(functions) => setLanguage({ ...language, functions })} />
        <SymbolTable kind="predicates" items={language.predicates} onChange={(predicates) => setLanguage({ ...language, predicates })} />
      </div>
      <ErrorList errors={errors} stages={['language']} />
      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? 'Verificando…' : 'Instalar lenguaje'}
      </button>
    </section>
  );
}
