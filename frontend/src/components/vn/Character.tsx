import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export type Expression = 'neutral' | 'talk' | 'happy' | 'confused';
export type CharacterName = 'turing' | 'godel' | 'tarski';

/** Archivo (en public/assets/characters/<nombre>/cutout/) de cada expresión.
 *  Si un personaje no tiene una expresión, se usa la neutral. */
const FILES: Record<CharacterName, Partial<Record<Expression, string>>> = {
  // Dibujos 2D. Las fotos anteriores quedan en turing/photos/ por si se quieren volver a usar.
  turing: { neutral: 'variation_1_neutral', talk: 'variation_3_hablando', happy: 'variation_2_feliz' },
  godel: { neutral: 'godel-neutral', talk: 'godel-talking', happy: 'godel-happy', confused: 'godel-confused' },
  tarski: { neutral: 'tarski-neutral', talk: 'tarski-talking', happy: 'tarski-happy', confused: 'tarski-confused' },
};

/** URLs de todas las expresiones de un personaje (para precargarlas antes de su escena). */
export const characterImages = (name: CharacterName) =>
  Object.values(FILES[name]).map((file) => `/assets/characters/${name}/cutout/${file}.png`);

interface Props {
  name: CharacterName;
  expression: Expression;
  /** Cambia en cada línea de diálogo para disparar el saltito. */
  beat: number;
  /** true mientras su texto se está escribiendo: rebota al ritmo del habla. */
  talking: boolean;
  side?: 'left' | 'right';
  /** true: sale de escena deslizándose por su lado. */
  leaving?: boolean;
  /** Clase extra para ubicarlo (p. ej. varios personajes en la misma escena). */
  className?: string;
}

/**
 * Recorte de personaje estilo novela visual. Tres capas de movimiento, cada una
 * en su propio contenedor para que no se pisen:
 *   1. entrada deslizándose desde el costado (una vez);
 *   2. saltito con aplastamiento al empezar cada línea;
 *   3. mientras habla, rebote corto y balanceo; en reposo, respiración lenta.
 * Las imágenes con contorno se generan con scripts/cutout.py.
 */
export function Character({ name, expression, beat, talking, side = 'left', leaving = false, className = '' }: Props) {
  const files = FILES[name];
  const current = files[expression] ? expression : 'neutral';
  const tilt = side === 'left' ? 1 : -1;
  // Hasta terminar de entrar, el personaje solo se desliza: el saltito y el rebote al
  // hablar esperan, para que la entrada no se vea temblorosa.
  const [entered, setEntered] = useState(false);
  const moving = entered && talking;
  // El saltito marca el cambio de línea: no se hace con la línea con la que entra.
  const firstBeat = useRef(beat);
  const hop = entered && beat !== firstBeat.current;

  return (
    <motion.div
      className={`vn-character vn-character-${side} ${className}`}
      initial={{ x: side === 'left' ? '-120%' : '120%' }}
      animate={{ x: leaving ? (side === 'left' ? '-120%' : '120%') : 0 }}
      // Curva que desacelera y termina exactamente en su lugar (un resorte "salta" unos px al detenerse).
      transition={leaving ? { duration: 0.7, ease: [0.5, 0, 0.75, 0], delay: 0.25 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      onAnimationComplete={() => setEntered(true)}
    >
      <motion.div
        key={beat}
        className="vn-character-layer"
        initial={{ y: 0, scaleX: 1, scaleY: 1 }}
        animate={hop ? {
          y: ['0%', '0.4%', '-1.8%', '0%'],
          scaleX: [1, 1.012, 0.995, 1],
          scaleY: [1, 0.988, 1.01, 1],
        } : {}}
        transition={{ duration: 0.5, times: [0, 0.2, 0.55, 1], ease: 'easeOut' }}
      >
        {/* Habla: rebote corto y balanceo. Empieza desde donde esté (null = valor actual)
            y al callar vuelve suave a reposo, así no hay saltos entre línea y línea. */}
        <motion.div
          className="vn-character-layer"
          initial={false}
          animate={
            moving
              ? { y: [null, '-0.6%', '0%'], rotate: [null, tilt * 0.4, 0, -tilt * 0.3, 0] }
              : { y: '0%', rotate: 0 }
          }
          transition={
            moving
              ? { y: { repeat: Infinity, duration: 0.34, ease: 'easeInOut' },
                  rotate: { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } }
              : { duration: 0.25, ease: 'easeOut' }
          }
        >
          {/* Respiración: capa propia que nunca se interrumpe (hable o no). */}
          <motion.div
            className="vn-character-layer"
            animate={{ scaleY: [1, 1.012, 1] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
          >
          {/* Los dibujos están hechos mirando hacia la derecha (para el lado izquierdo);
              a la derecha se reflejan para que el personaje mire hacia el centro. */}
          <div className={`vn-character-layer ${side === 'right' ? 'vn-flip' : ''}`}>
            {/* Todas las expresiones quedan cargadas y apiladas: cambiar de cara es
                instantáneo, sin parpadeo mientras se descarga la imagen nueva. */}
            {(Object.entries(files) as Array<[Expression, string]>).map(([expr, file]) => (
              <img
                key={expr}
                src={`/assets/characters/${name}/cutout/${file}.png`}
                alt=""
                draggable={false}
                className="vn-expression"
                style={{ opacity: expr === current ? 1 : 0 }}
              />
            ))}
          </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
