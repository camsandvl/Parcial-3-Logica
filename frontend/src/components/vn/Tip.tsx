import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Props que el elemento con globo debe recibir (eventos para mostrarlo y foco con teclado). */
export interface TipTargetProps {
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
  tabIndex?: number;
  'aria-describedby'?: string;
}

let nextId = 0;

/**
 * Globo explicativo dibujado a mano, que aparece al pasar el mouse o enfocar con Tab.
 * Se dibuja en <body> con posición fija: ningún contenedor con overflow (p. ej. el
 * estante) puede recortarlo. Uso con render prop, para no alterar el estilo del elemento:
 *
 *   <Tip content="Devuelve un elemento de D">{(p) => <span className="tile-output" {...p} />}</Tip>
 */
export function Tip({ content, children, off = false }: { content: ReactNode; children: (props: TipTargetProps) => ReactNode; off?: boolean }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [id] = useState(() => `tip-${++nextId}`);
  const show = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => setRect(e.currentTarget.getBoundingClientRect());
  const hide = () => setRect(null);

  // Arriba del elemento; si no cabe (cerca del borde superior), abajo.
  const below = rect ? rect.top < 110 : false;

  // off: el elemento se dibuja igual, pero sin globo (p. ej. fichas chicas del estante).
  if (off) return <>{children({})}</>;

  return (
    <>
      {children({ onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide, tabIndex: 0, 'aria-describedby': rect ? id : undefined })}
      {rect && createPortal(
        <div
          id={id}
          role="tooltip"
          className={`hand-tip ${below ? 'is-below' : ''}`}
          style={{ left: rect.left + rect.width / 2, top: below ? rect.bottom : rect.top }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
