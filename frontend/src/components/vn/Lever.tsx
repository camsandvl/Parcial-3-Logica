import { motion } from 'framer-motion';

/** Palanca montada en el costado de la máquina: alterna lever-off.png (arriba) y
 *  lever-on.png (abajo) con un pequeño golpe al cambiar. */
export function Lever({ down, enabled, onPull }: { down: boolean; enabled: boolean; onPull: () => void }) {
  return (
    <motion.button
      type="button"
      className={`vn-lever ${enabled && !down ? 'is-enabled' : ''}`}
      onClick={onPull}
      disabled={!enabled || down}
      aria-label={down ? 'Palanca bajada' : 'Jalar la palanca para encender la máquina'}
      animate={down ? { y: ['0%', '4%', '-1%', '0%'] } : {}}
      transition={{ duration: 0.35 }}
    >
      <img src="/assets/scene1/lever-off.png" alt="" draggable={false} style={{ opacity: down ? 0 : 1 }} />
      <img src="/assets/scene1/lever-on.png" alt="" draggable={false} style={{ opacity: down ? 1 : 0 }} />
    </motion.button>
  );
}
