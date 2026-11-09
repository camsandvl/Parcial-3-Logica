import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * La máquina de Turing como CONCEPTO: el boceto en papel de 1936 (machine-concept.png,
 * 2303×1536) con cinta, cabezal, unidad de control (estados) y un cuadro de mensajes.
 * Al encenderse, la hoja "cobra vida" con capas de tinta y resaltador encima:
 *   - el cuadro de mensajes se escribe a mano;
 *   - los 4 círculos (módulos del juego) se rellenan con marcador;
 *   - un resaltador recorre los estados y termina en el de aceptación (doble círculo);
 *   - se escriben símbolos en la cinta, casilla por casilla.
 * Todas las coordenadas están medidas en píxeles de machine-concept.png.
 */
const W = 2303;
const H = 1536;
const pct = (x: number, y: number, w: number, h: number) => ({
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  width: `${(w / W) * 100}%`,
  height: `${(h / H) * 100}%`,
});

const DISPLAY = pct(812, 194, 679, 168);
const LAMPS = [944, 1081, 1219, 1358].map((cx) => pct(cx - 31, 427 - 31, 62, 62));

/** Estados del diagrama, en el orden de las flechas; el último es el de aceptación (doble círculo). */
const STATES = [[1151, 565], [1315, 682], [1151, 789], [988, 676]];
const STATE_R = 54;

/** Bordes verticales de las 12 casillas de la cinta. */
const CELL_EDGES = [427, 546, 674, 804, 933, 1064, 1195, 1326, 1457, 1586, 1716, 1846, 1975];
const TAPE_Y = 1130;
const TAPE_H = 105;
const HEAD_CELL = 5; // la casilla a la que apunta la flecha del cabezal
const SYMBOLS = ['1', '0', '1', '1', '0', '1', '0', '0', '1', '1', '0', '1'];

/** Etiquetas a mano que explican cada parte del concepto. */
const LABELS: Array<{ text: string; x: number; y: number; rotate: number; align?: 'right' }> = [
  { text: 'resultado', x: 760, y: 250, rotate: -4, align: 'right' },
  { text: 'estados', x: 860, y: 600, rotate: -3, align: 'right' },
  { text: 'cabezal: lee y escribe', x: 1400, y: 960, rotate: 2 },
  { text: 'cinta infinita', x: 1201, y: 1290, rotate: -1 },
];

const T0 = 0.3; // inicio de la secuencia de encendido (s)
const STATE_STEP = 0.42;

interface Props {
  on: boolean;
  /** Círculos de módulo rellenos (0 a 4). En la escena 1 se rellenan todos en secuencia. */
  lamps?: number;
  screenText?: string;
  /** true: la nota se despegó de la pared y está al frente, grande. */
  big?: boolean;
  /** Algo para el usuario pegado al borde inferior de la nota (p. ej. el botón de encendido). */
  action?: ReactNode;
}

export function Machine({ on, lamps = on ? 4 : 0, screenText, big = false, action }: Props) {
  // El resaltador da dos vueltas por los estados y se detiene en el de aceptación.
  const path = [...STATES, ...STATES];
  const hlLeft = path.map(([x]) => `${((x - STATE_R) / W) * 100}%`);
  const hlTop = path.map(([, y]) => `${((y - STATE_R) / H) * 100}%`);

  return (
    // layoutId: al pasar de la pared al frente, framer anima el cambio de posición y tamaño
    // (es el mismo elemento "despegándose", aunque cambie de contenedor).
    <motion.div
      layoutId="turing-note"
      className={`vn-machine sketch ${on ? 'is-on' : ''} ${big ? 'is-big' : ''}`}
      initial={false}
      animate={{ rotate: big ? -1.5 : 0 }}
      transition={{ type: 'spring', stiffness: 70, damping: 16 }}
    >
      <img
        className="machine-base"
        src="/assets/scene1/machine-concept.png"
        alt="Boceto de la máquina de Turing: una cinta infinita con casillas, un cabezal que lee y escribe, una unidad de control con estados y un cuadro de resultado"
        draggable={false}
      />

      {LABELS.map((l) => (
        <span
          key={l.text}
          className={`sketch-label ${l.align === 'right' ? 'is-right' : ''}`}
          style={{ left: `${(l.x / W) * 100}%`, top: `${(l.y / H) * 100}%`, rotate: `${l.rotate}deg` }}
        >
          {l.text}
        </span>
      ))}

      {/* Resaltador que recorre los estados */}
      <motion.span
        className="sketch-state-hl"
        style={{ width: `${((2 * STATE_R) / W) * 100}%`, height: `${((2 * STATE_R) / H) * 100}%` }}
        initial={false}
        animate={on ? { opacity: 1, left: hlLeft, top: hlTop } : { opacity: 0 }}
        transition={on ? { delay: T0, duration: STATE_STEP * path.length, ease: 'linear', opacity: { delay: T0, duration: 0.2 } } : { duration: 0.2 }}
      />

      {/* Casilla bajo el cabezal + símbolos escritos en la cinta */}
      <motion.span
        className="sketch-cell-hl"
        style={pct(CELL_EDGES[HEAD_CELL], TAPE_Y, CELL_EDGES[HEAD_CELL + 1] - CELL_EDGES[HEAD_CELL], TAPE_H)}
        initial={false}
        animate={on ? { opacity: [0, 1, 0.5, 1] } : { opacity: 0 }}
        transition={{ delay: on ? T0 : 0, duration: 1.2 }}
      />
      {SYMBOLS.map((s, i) => (
        <motion.span
          key={i}
          className="sketch-symbol"
          style={pct(CELL_EDGES[i], TAPE_Y, CELL_EDGES[i + 1] - CELL_EDGES[i], TAPE_H)}
          initial={false}
          animate={on ? { opacity: 1, scale: [1.6, 1] } : { opacity: 0, scale: 1 }}
          transition={{ delay: on ? T0 + 0.25 + i * 0.18 : 0, duration: 0.2 }}
        >
          {s}
        </motion.span>
      ))}

      {/* Círculos de módulo: se rellenan con marcador */}
      {LAMPS.map((style, i) => (
        <motion.span
          key={i}
          className="sketch-lamp"
          style={style}
          initial={false}
          animate={{ opacity: i < lamps ? 1 : 0, scale: i < lamps ? [0.3, 1.1, 1] : 0.3 }}
          transition={{ duration: 0.3, delay: on ? 0.9 + i * 0.25 : 0 }}
        />
      ))}

      {/* Cuadro de resultado: el mensaje se escribe a mano, de izquierda a derecha */}
      <div className="sketch-display" style={DISPLAY}>
        {screenText && (
          <motion.span
            className="sketch-display-text"
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={on ? { clipPath: 'inset(0 0% 0 0)' } : { clipPath: 'inset(0 100% 0 0)' }}
            transition={{ delay: T0 + STATE_STEP * path.length, duration: 0.9, ease: 'easeOut' }}
          >
            {screenText}
          </motion.span>
        )}
      </div>

      {action}
    </motion.div>
  );
}
