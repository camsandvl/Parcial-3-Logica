import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Element } from '@contracts/types';

interface Props {
  name: string;
  domain: Element[];
  value: Element | undefined;
  /** Otras constantes ya definidas: también se ven sus etiquetas (más tenues). */
  others: Array<{ name: string; value: Element | undefined }>;
  onPick: (value: Element) => void;
}

/**
 * Una constante como etiqueta: reaparece el mundo D del paso del dominio y al hacer clic
 * en un elemento se le cuelga una etiqueta de papel con el nombre de la constante.
 * Así se ve que una constante no es una regla: es otro nombre para un elemento de D.
 */
export function ConstantPicker({ name, domain, value, others, onPick }: Props) {
  return (
    <div className="cp-wrap">
      <p className="fd-status">
        {value === undefined
          ? <>Haz clic en el elemento del mundo que nombra <b>{name}</b>.</>
          : <>Listo: <b>{name}</b> nombra a un elemento. Puedes cambiarlo con otro clic.</>}
      </p>

      <div className="domain-world cp-world" style={{ '--n': Math.max(1, domain.length) } as CSSProperties}>
        <span className="dw-label">D</span>
        <div className="dw-items">
          {domain.map((e, i) => {
            const tags = others.filter((o) => o.value === e);
            const mine = value === e;
            return (
              <div key={e} className="cp-slot" style={{ translate: `0 ${[0, -14, 8, -6, 12, -10][i % 6]}%` }}>
                <button type="button" className={`dw-dot cp-dot ${mine ? 'is-chosen' : ''}`} onClick={() => onPick(e)}
                  aria-pressed={mine} aria-label={`${name} nombra a ${e}`}>
                  {e}
                </button>
                {/* Etiquetas colgando del elemento: la de esta constante y las de otras */}
                <div className="cp-tags">
                  {mine && (
                    <motion.span key={name} className="cp-tag is-mine" initial={{ y: -10, opacity: 0, rotate: -20 }}
                      animate={{ y: 0, opacity: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
                      {name}
                    </motion.span>
                  )}
                  {tags.map((o) => <span key={o.name} className="cp-tag">{o.name}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="fd-reading">
        <code>{name} = {value ?? '?'}</code>
        {value !== undefined ? <> · «{name}» es otro nombre del {value}</> : <> · todavía no nombra a nadie</>}
      </p>
    </div>
  );
}
