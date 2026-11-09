import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { SymbolDecl } from '@contracts/types';

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
 * Ficha de latón: una entrada (●) arriba por cada argumento; a la derecha, una salida
 * si es función (devuelve un elemento de D) o un foco si es predicado (verdadero/falso).
 */
export function SymbolTile({ kind, symbol, position, error, onRemove, size = 'md' }: Props) {
  const g = godelNumber(kind, symbol.arity, position);
  const isConstant = kind === 'functions' && symbol.arity === 0;
  const label = kind === 'predicates' ? 'Predicado' : isConstant ? 'Constante' : 'Función';
  const ref = useRef<HTMLDivElement>(null);

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
      title={`Número de Gödel: ${g.formula} = ${g.value}`}
    >
      <div className="tile-sockets" aria-label={`aridad ${symbol.arity}`}>
        {Array.from({ length: symbol.arity }, (_, i) => <span key={i} className="tile-socket" />)}
      </div>
      <div className="tile-body">
        <span className="tile-kind">{label}</span>
        <span className="tile-name">{symbol.name || '?'}</span>
        <span className="tile-sig">{signature(kind, { ...symbol, name: symbol.name || '?' })}</span>
        <span className="tile-godel">Nº {g.value.toLocaleString('es')}</span>
      </div>
      <span className={kind === 'predicates' ? 'tile-bulb' : 'tile-output'} aria-hidden="true" />
      {onRemove && <button type="button" className="tile-remove" onClick={onRemove} aria-label={`Quitar ${symbol.name}`}>×</button>}
      {error && <p className="tile-error">{error}</p>}
    </motion.div>
  );
}
