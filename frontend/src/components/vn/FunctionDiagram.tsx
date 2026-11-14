import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Element } from '@contracts/types';

interface Props {
  name: string;
  /** Todas las entradas: tuplas de Dⁿ (una tupla vacía [] para una constante). */
  inputs: Element[][];
  domain: Element[];
  valueOf: (args: Element[]) => Element | undefined;
  setValue: (args: Element[], value: Element) => void;
}

/** A partir de cuántas entradas se sugiere un dominio más chico. */
const MANY = 27;

interface Arrow { key: string; d: string; on: boolean }

const label = (args: Element[], name: string) =>
  args.length === 0 ? name : args.length === 1 ? args[0] : `(${args.join(', ')})`;

/**
 * Una función como diagrama de flechas (como se enseña en el colegio):
 * entradas a la izquierda, el dominio D a la derecha. Se elige una entrada y luego
 * su resultado, y se dibuja la flecha. De cada entrada sale exactamente una flecha:
 * eso es lo que hace a la regla una función.
 */
export function FunctionDiagram({ name, inputs, domain, valueOf, setValue }: Props) {
  const firstEmpty = inputs.findIndex((a) => valueOf(a) === undefined);
  const [sel, setSel] = useState(firstEmpty === -1 ? 0 : firstEmpty);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const inCol = useRef<HTMLDivElement>(null);
  const outCol = useRef<HTMLDivElement>(null);
  const inRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const outRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const pending = inputs.filter((a) => valueOf(a) === undefined).length;
  const selected = inputs[sel] ?? inputs[0];

  /** Recalcula las flechas según dónde están las bolitas (cambian al desplazar o redimensionar). */
  const measure = useCallback(() => {
    const b = box.current?.getBoundingClientRect();
    const ic = inCol.current?.getBoundingClientRect();
    const oc = outCol.current?.getBoundingClientRect();
    if (!b || !ic || !oc) return;
    const visible = (r: DOMRect, c: DOMRect) => r.bottom > c.top + 4 && r.top < c.bottom - 4;
    const next: Arrow[] = [];
    inputs.forEach((args, i) => {
      const v = valueOf(args);
      const a = inRefs.current[i]?.getBoundingClientRect();
      const o = v !== undefined ? outRefs.current[v]?.getBoundingClientRect() : undefined;
      if (!a || !o || !visible(a, ic) || !visible(o, oc)) return;
      const x1 = a.right - b.left + 4, y1 = a.top + a.height / 2 - b.top;
      const x2 = o.left - b.left - 8, y2 = o.top + o.height / 2 - b.top;
      const mx = (x1 + x2) / 2;
      next.push({ key: args.join(','), d: `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, on: i === sel });
    });
    setArrows((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [inputs, valueOf, sel]);

  useLayoutEffect(measure);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [measure]);

  const choose = (v: Element) => {
    setValue(selected, v);
    // Avanza sola a la siguiente entrada sin resultado (después de la actual, luego desde el inicio).
    const order = [...inputs.keys()].slice(sel + 1).concat([...inputs.keys()].slice(0, sel));
    const nextEmpty = order.find((i) => i !== sel && valueOf(inputs[i]) === undefined);
    if (nextEmpty !== undefined) setSel(nextEmpty);
  };

  const current = valueOf(selected);

  return (
    <div className="fd-wrap">
      <p className="fd-status">
        {pending === 0
          ? <>Listo: cada entrada tiene exactamente un resultado.</>
          : <>Haz clic en una entrada y luego en su resultado · faltan <b>{pending}</b> de {inputs.length}</>}
        {inputs.length > MANY && <> Con un dominio más chico habría muchas menos entradas.</>}
      </p>

      <div className="fd" ref={box} style={{ '--n': Math.max(domain.length, inputs.length) } as CSSProperties}>
        <div className="fd-col">
          <span className="fd-title">entradas</span>
          <div className="fd-list" ref={inCol} onScroll={measure}>
            {inputs.map((args, i) => {
              const v = valueOf(args);
              return (
                <button key={args.join(',') || name} type="button" ref={(el) => { inRefs.current[i] = el; }}
                  className={`fd-dot ${args.length > 1 ? 'is-tuple' : ''} ${i === sel ? 'is-sel' : ''} ${v === undefined ? 'is-empty' : ''}`}
                  onClick={() => setSel(i)} aria-pressed={i === sel}
                  aria-label={`${name}(${args.join(', ')}) ${v === undefined ? 'sin resultado' : `= ${v}`}`}>
                  {label(args, name)}
                </button>
              );
            })}
          </div>
        </div>

        <svg className="fd-arrows" aria-hidden="true">
          <defs>
            {/* Una punta por color: la flecha seleccionada va en verde, las demás en tinta tenue */}
            <marker id="fd-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="rgba(29, 26, 51, .55)" />
            </marker>
            <marker id="fd-head-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#2e5e4e" />
            </marker>
          </defs>
          {arrows.map((a) => <path key={a.key} d={a.d} className={a.on ? 'on' : ''} markerEnd={a.on ? 'url(#fd-head-on)' : 'url(#fd-head)'} />)}
        </svg>

        <div className="fd-col">
          <span className="fd-title">resultados en D</span>
          <div className="fd-list" ref={outCol} onScroll={measure}>
            {domain.map((d) => (
              <button key={d} type="button" ref={(el) => { outRefs.current[d] = el; }}
                className={`fd-dot ${current === d ? 'is-chosen' : ''}`} onClick={() => choose(d)}
                aria-label={`${name}(${selected.join(', ')}) = ${d}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="fd-reading">
        <code>{selected.length ? `${name}(${selected.join(', ')})` : name} = {current ?? '?'}</code>
        {current !== undefined
          ? <> · {selected.length ? `${name} lleva ${label(selected, name)} al ${current}` : `${name} nombra al ${current}`}</>
          : <> · elige su resultado a la derecha</>}
      </p>
    </div>
  );
}
