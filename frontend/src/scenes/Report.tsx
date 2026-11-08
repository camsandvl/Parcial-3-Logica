import { motion } from 'framer-motion';
import type { TraceNode } from '@contracts/types';
import { Guide } from '../components/Guide';
import { useMachine } from '../store/machine';

const KIND_LABEL: Record<TraceNode['kind'], string> = {
  witness: 'Testigo',
  counterexample: 'Contraejemplo',
  full_check: 'Comprobación completa',
  connective: 'Conectivo decisivo',
  atomic: 'Atómica',
};

/** Un nodo de la traza; los hijos aparecen en cascada (base del recorrido animado). */
function TraceView({ node, depth = 0 }: { node: TraceNode; depth?: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: depth * 0.5 }}
      className={`trace-node ${node.value ? 'true' : 'false'}`}
    >
      <div className="trace-head">
        <span className={`lamp ${node.value ? 'ready' : 'error'}`} />
        <code>{node.text}</code>
        <span className="badge">{KIND_LABEL[node.kind]}</span>
        <strong>{node.value ? 'V' : 'F'}</strong>
      </div>
      {node.checked && (
        <table className="machine-table">
          <thead><tr><th>{node.var}</th><th>valor</th></tr></thead>
          <tbody>
            {node.checked.map((row, i) => {
              const decisive = node.decisive && node.var && node.decisive[node.var] === row[node.var!];
              return (
                <tr key={i} className={decisive ? 'decisive' : ''}>
                  <td>{node.var && row[node.var]}</td>
                  <td>{row.value ? 'V' : 'F'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {node.children.length > 0 && (
        <ul>{node.children.map((c, i) => <TraceView key={i} node={c} depth={depth + 1} />)}</ul>
      )}
    </motion.li>
  );
}

export function Report() {
  const result = useMachine((s) => s.result);

  if (!result) {
    return (
      <section className="scene scene-processing">
        <h2>Escena 5 · Procesamiento</h2>
        <div className="processing" role="status">
          <motion.div className="gear" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}>⚙</motion.div>
          <p>La máquina está evaluando…</p>
        </div>
      </section>
    );
  }
  if (!result.ok) return null; // con errores nunca hay veredicto

  return (
    <section className="scene scene-processing">
      <h2>Escena 6 · Informe</h2>
      <motion.div
        className={`verdict ${result.value ? 'true' : 'false'}`}
        initial={{ scale: 2, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      >
        {result.value ? 'VERDADERO' : 'FALSO'}
      </motion.div>
      <Guide name="Turing">{result.summary}</Guide>
      <h3>Razones decisivas</h3>
      <ul className="trace"><TraceView node={result.trace} /></ul>
    </section>
  );
}
