import { NavLink } from 'react-router-dom';
import { MODULES, useMachine, type ModuleId } from '../store/machine';

const LABELS: Record<ModuleId, { title: string; path: string }> = {
  activation: { title: 'Activación', path: '/' },
  language: { title: 'Taller de Gödel', path: '/lenguaje' },
  universe: { title: 'Sala de Tarski', path: '/universo' },
  console: { title: 'Consola', path: '/consola' },
  report: { title: 'Informe', path: '/informe' },
};

/** Barra lateral: un foco por módulo (apagado, activo, error, listo). */
export function ControlPanel() {
  const status = useMachine((s) => s.status);
  return (
    <nav className="control-panel" aria-label="Módulos de la máquina">
      <h1 className="brand">Máquina de Turing</h1>
      <ol>
        {MODULES.map((m) => {
          const st = status[m];
          const { title, path } = LABELS[m];
          return (
            <li key={m}>
              {st === 'locked' ? (
                <span className="module locked" aria-disabled="true">
                  <span className={`lamp ${st}`} /> {title}
                </span>
              ) : (
                <NavLink to={path} end className="module">
                  <span className={`lamp ${st}`} /> {title}
                </NavLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
