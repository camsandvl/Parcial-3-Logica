import { motion } from 'framer-motion';

export type Expression = 'neutral' | 'talk' | 'happy';

interface Props {
  name: 'turing';
  expression: Expression;
  /** Cambia en cada línea de diálogo para disparar el saltito. */
  beat: number;
  /** true mientras su texto se está escribiendo: rebota al ritmo del habla. */
  talking: boolean;
  side?: 'left' | 'right';
}

/**
 * Recorte de personaje estilo novela visual. Tres capas de movimiento, cada una
 * en su propio contenedor para que no se pisen:
 *   1. entrada deslizándose desde el costado (una vez);
 *   2. saltito con aplastamiento al empezar cada línea;
 *   3. mientras habla, rebote corto y balanceo; en reposo, respiración lenta.
 * Las imágenes con contorno se generan con scripts/cutout.py.
 */
export function Character({ name, expression, beat, talking, side = 'left' }: Props) {
  const src = `/assets/characters/${name}/cutout/${name}-${expression}.png`;
  const tilt = side === 'left' ? 1 : -1;

  return (
    <motion.div
      className={`vn-character vn-character-${side}`}
      initial={{ x: side === 'left' ? '-120%' : '120%' }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.3 }}
    >
      <motion.div
        key={beat}
        className="vn-character-layer"
        initial={{ y: 0, scaleX: 1, scaleY: 1 }}
        animate={{
          y: ['0%', '0.4%', '-1.8%', '0%'],
          scaleX: [1, 1.012, 0.995, 1],
          scaleY: [1, 0.988, 1.01, 1],
        }}
        transition={{ duration: 0.5, times: [0, 0.2, 0.55, 1], ease: 'easeOut' }}
      >
        <motion.div
          className="vn-character-layer"
          animate={
            talking
              ? { y: ['0%', '-0.6%', '0%'], rotate: [0, tilt * 0.4, 0, -tilt * 0.3, 0], scaleY: [1, 1.006, 1] }
              : { y: '0%', rotate: 0, scaleY: [1, 1.012, 1] }
          }
          transition={
            talking
              ? { y: { repeat: Infinity, duration: 0.34, ease: 'easeInOut' },
                  rotate: { repeat: Infinity, duration: 1.6, ease: 'easeInOut' },
                  scaleY: { repeat: Infinity, duration: 0.34, ease: 'easeInOut' } }
              : { y: { duration: 0.2 }, rotate: { duration: 0.3 },
                  scaleY: { repeat: Infinity, duration: 3.2, ease: 'easeInOut' } }
          }
        >
          <img src={src} alt="" draggable={false} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
