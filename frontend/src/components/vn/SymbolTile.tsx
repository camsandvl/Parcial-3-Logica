import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { SymbolDecl } from '@contracts/types';
import { Tip } from './Tip';

export type SymbolKind = 'functions' | 'predicates';

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const sup = (n: number) => String(n).split('').map((d) => SUPERSCRIPT[Number(d)]).join('');

/**
 * Número de Gödel de un símbolo del lenguaje (aporte creativo).
 *   G = 2^tipo · 3^aridad · 5^posición
 * tipo: 1 = función, 2 = predicado; posición: 1, 2, 3… dentro de su tipo.
 * Por el teorema fundamental de la aritmética (factorización única en primos),
 * dos símbolos distintos nunca comparten número, y del número se recupera el símbolo.
 */
export function godelNumber(kind: SymbolKind, arity: number, position: number) {
  const type = kind === 'functions' ? 1 : 2;
  return {
    value: 2 ** type * 3 ** arity * 5 ** position,
    formula: `2${sup(type)}·3${sup(arity)}·5${sup(position)}`,
  };
}

/** Notación de lo que el símbolo representa en una interpretación. */
function signature(kind: SymbolKind, s: SymbolDecl) {
  if (kind === 'predicates') return `${s.name} ⊆ D${s.arity > 1 ? sup(s.arity) : ''}`;
  if (s.arity === 0) return `${s.name} ∈ D`;
  return `${s.name} : D${s.arity > 1 ? sup(s.arity) : ''} → D`;
}

const VARS = ['x', 'y', 'z', 'w'];

/** Explicación en palabras de la notación, para el globo. */
function signatureHelp(kind: SymbolKind, s: SymbolDecl): ReactNode {
  const n = s.arity;
  const tuples = n > 1 ? <> D{sup(n)} son todas las {n}-tuplas de elementos de D.</> : null;
  if (kind === 'predicates')
    return <>⊆ «subconjunto de»: {s.name} es el conjunto de {n > 1 ? `${n}-tuplas` : 'elementos'} donde es verdadero.{tuples}</>;
  if (n === 0) return <>∈ «pertenece a»: {s.name} nombra un elemento fijo del dominio D.</>;
  return <>→ «va de… a…»: {s.name} recibe {n > 1 ? `${n} elementos` : 'un elemento'} de D y devuelve uno de D.{tuples}</>;
}

interface Props {
  kind: SymbolKind;
  symbol: SymbolDecl;
  position: number;
  error?: string;
  /** Sin onRemove no se muestra el botón de quitar (p. ej. en la vista previa). */
  onRemove?: () => void;
  /** sm: estante · md: normal · lg: vista previa mientras se fabrica. */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Ficha de símbolo: un enchufe arriba por cada argumento; a la derecha, una salida
 * si es función (devuelve un elemento de D) o un foco si es predicado (verdadero/falso).
 * Cada pieza explica su significado en un globo al pasar el mouse.
 */
export function SymbolTile({ kind, symbol, position, error, onRemove, size = 'md' }: Props) {
  const g = godelNumber(kind, symbol.arity, position);
  const isConstant = kind === 'functions' && symbol.arity === 0;
  const label = kind === 'predicates' ? 'Predicado' : isConstant ? 'Constante' : 'Función';
  const ref = useRef<HTMLDivElement>(null);
  // En el estante las fichas son muy chicas para explicar piezas: sin globos.
  const noTips = size === 'sm';

  // Si la ficha tiene un error y quedó fuera de la vista de la bandeja, se desplaza hasta ella.
  useEffect(() => {
    if (error) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [error]);

  return (
    <motion.div
      ref={ref}
      layout
      className={`tile tile-${kind} tile-${size} ${error ? 'has-error' : ''}`}
      initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 0.4, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
    >
      <div className="tile-sockets" aria-label={`aridad ${symbol.arity}`}>
        {Array.from({ length: symbol.arity }, (_, i) => (
          <Tip key={i} off={noTips} content={<><b>Argumento {i + 1}</b> · se escribe {VARS.at(i) ?? 'x'} en {symbol.name || '?'}({VARS.slice(0, symbol.arity).join(', ')})</>}>
            {(tp) => <span className="tile-socket" aria-label={`argumento ${i + 1}`} {...tp} />}
          </Tip>
        ))}
      </div>
      <div className="tile-body">
        <span className="tile-kind">{label}</span>
        <span className="tile-name" style={{ '--len': Math.max(1, symbol.name.length) } as CSSProperties}>{symbol.name || '?'}</span>
        <Tip off={noTips} content={signatureHelp(kind, { ...symbol, name: symbol.name || '?' })}>
          {(tp) => <span className="tile-sig has-tip" {...tp}>{signature(kind, { ...symbol, name: symbol.name || '?' })}</span>}
        </Tip>
        {/* Número de Gödel: al pasar el mouse (o enfocar con teclado) se ve cómo se calcula */}
        <Tip off={noTips} content={<><b>{g.formula} = {g.value.toLocaleString('es')}</b><br /><small>2<sup>tipo</sup> · 3<sup>aridad</sup> · 5<sup>posición</sup></small></>}>
          {(tp) => <span className="tile-godel has-tip" aria-label={`Número de Gödel ${g.value}: ${g.formula}`} {...tp}>Nº {g.value.toLocaleString('es')}</span>}
        </Tip>
      </div>
      {kind === 'predicates' ? (
        <Tip off={noTips} content={<><b>Foco</b> · un predicado no devuelve un elemento: dice si algo es <b>verdadero</b> o <b>falso</b>.</>}>
          {(tp) => <span className="tile-bulb has-tip" aria-label="foco: verdadero o falso" {...tp} />}
        </Tip>
      ) : (
        <Tip off={noTips} content={<><b>Salida</b> · devuelve un elemento del dominio D.</>}>
          {(tp) => <span className="tile-output has-tip" aria-label="salida: un elemento de D" {...tp} />}
        </Tip>
      )}
      {onRemove && <button type="button" className="tile-remove" onClick={onRemove} aria-label={`Quitar ${symbol.name}`}>×</button>}
      {error && <p className="tile-error">{error}</p>}
    </motion.div>
  );
}
