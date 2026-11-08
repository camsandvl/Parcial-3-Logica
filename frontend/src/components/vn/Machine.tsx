import { motion } from 'framer-motion';

/**
 * La máquina es una sola imagen (apagada). El encendido se simula con capas de luz
 * colocadas encima, en porcentajes medidos sobre machine.png (1448×1086).
 */
const pct = (x: number, y: number, w: number, h: number) => ({
  left: `${(x / 1448) * 100}%`,
  top: `${(y / 1086) * 100}%`,
  width: `${(w / 1448) * 100}%`,
  height: `${(h / 1086) * 100}%`,
});

const SCREEN = pct(572, 88, 320, 320);
const LAMPS = [590, 678, 766, 851].map((cx) => pct(cx - 24, 440, 48, 48));
const ROTORS = [pct(220, 262, 248, 230), pct(980, 262, 248, 230)];
const PLATE = pct(565, 525, 310, 53);

interface Props {
  on: boolean;
  /** Luces de módulo encendidas (0 a 4). En la escena 1 se encienden todas en secuencia. */
  lamps?: number;
  screenText?: string;
}

export function Machine({ on, lamps = on ? 4 : 0, screenText }: Props) {
  return (
    <div className={`vn-machine ${on ? 'is-on' : ''}`}>
      <img src="/assets/scene1/machine.png" alt="La máquina de Turing" draggable={false} />

      {/* Placa con el nombre: el texto va en código porque la IA deforma las letras. */}
      <div className="machine-plate" style={PLATE}>MÁQUINA DE TURING</div>

      {ROTORS.map((style, i) => (
        <motion.div
          key={i}
          className="machine-rotor-glow"
          style={style}
          initial={false}
          animate={on ? { opacity: [0, 0.9, 0.6, 0.85] } : { opacity: 0 }}
          transition={on ? { duration: 1.2, delay: 0.4 + i * 0.15, times: [0, 0.3, 0.6, 1] } : { duration: 0.3 }}
        />
      ))}

      {LAMPS.map((style, i) => (
        <motion.div
          key={i}
          className="machine-lamp"
          style={style}
          initial={false}
          animate={{ opacity: i < lamps ? 1 : 0, scale: i < lamps ? [0.6, 1.25, 1] : 1 }}
          transition={{ duration: 0.35, delay: on ? 0.9 + i * 0.25 : 0 }}
        />
      ))}

      <motion.div
        className="machine-screen"
        style={SCREEN}
        initial={false}
        // Parpadeo de tubo de rayos catódicos al encender.
        animate={on ? { opacity: [0, 1, 0.2, 1, 0.6, 1] } : { opacity: 0 }}
        transition={on ? { duration: 0.9, delay: 0.2, times: [0, 0.15, 0.3, 0.5, 0.7, 1] } : { duration: 0.3 }}
      >
        {screenText && <span className="machine-screen-text">{screenText}</span>}
      </motion.div>
    </div>
  );
}
