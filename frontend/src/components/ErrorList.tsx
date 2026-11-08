import type { Stage, ValidationError } from '@contracts/types';

/** Panel de "máquina bloqueada": nunca se muestra valor de verdad junto a errores.
 *  Cada escena muestra solo los errores de sus etapas. */
export function ErrorList({ errors: all, stages }: { errors: ValidationError[]; stages: Stage[] }) {
  const errors = all.filter((e) => stages.includes(e.stage));
  if (!errors.length) return null;
  return (
    <div className="error-list" role="alert">
      <strong>⚠ Máquina bloqueada — corrige antes de continuar</strong>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>
            <code>{e.code}</code> {e.message}
            {e.path && <span className="path"> · {e.path}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
