import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { Character, characterImages, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { Machine } from '../components/vn/Machine';
import { useMachine } from '../store/machine';
import { preloadImages } from '../utils/preload';

interface Line {
  expression: Expression;
  text: string;
  /** La línea espera a que el usuario pulse el botón de la nota. */
  waitsForStart?: boolean;
}

const SCRIPT: Line[] = [
  { expression: 'neutral', text: 'Ah, por fin, un operador. Soy Alan Turing, y esta es mi máquina más ambiciosa.' },
  { expression: 'talk', text: 'Evalúa fórmulas de lógica de primer orden. Pero una fórmula solo es verdadera o falsa dentro de un mundo concreto: una interpretación.' },
  { expression: 'talk', text: 'Con Gödel declararás el lenguaje: funciones y predicados con su aridad. Con Tarski construirás el mundo: un dominio y el significado de cada símbolo.' },
  { expression: 'talk', text: 'Después escribirás la fórmula, y te diré si es verdadera o falsa, con un testigo o un contraejemplo como prueba.' },
  { expression: 'talk', text: 'Pero antes hay que ponerla en marcha. Pulsa el botón.', waitsForStart: true },
  { expression: 'happy', text: '¡Mira cómo cobra vida! Así razona la máquina: lee, escribe y cambia de estado. Vamos al taller de Gödel.' },
];

/** A partir de esta línea la nota se despega de la pared y queda al frente, grande. */
const NOTE_BIG_FROM = 1;

export function Activation() {
  const markReady = useMachine((s) => s.markReady);
  const navigate = useNavigate();
  const [line, setLine] = useState(0);
  const [on, setOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const shake = useAnimationControls();
  const current = SCRIPT[line];
  const big = line >= NOTE_BIG_FROM;

  // Mientras el usuario lee, se descarga la escena 2 (Gödel y su fondo).
  useEffect(() => {
    preloadImages([...characterImages('godel'), '/assets/scene2/bg-workshop.png']);
  }, []);

  const advance = () => {
    if (line < SCRIPT.length - 1) setLine(line + 1);
    else {
      markReady('activation');
      navigate('/lenguaje');
    }
  };

  const start = () => {
    setOn(true);
    // Sacudida de la habitación cuando la máquina arranca.
    void shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.45, delay: 0.15 } });
    setTimeout(() => setLine(line + 1), 2200);
  };

  const note = (
    <Machine
      on={on}
      big={big}
      screenText={on ? 'SISTEMA LISTO' : undefined}
      action={
        current.waitsForStart && !on ? (
          <motion.button
            type="button"
            className="sketch-start"
            onClick={start}
            initial={{ scale: 0, rotate: -8 }}
            animate={{ scale: 1, rotate: -3 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          >
            ▶ Poner en marcha
          </motion.button>
        ) : null
      }
    />
  );

  return (
    <section className={`vn-scene ${on ? 'is-on' : ''}`} aria-label="Escena 1: Activación">
      {/* Escenario 16:9 que cubre el área: fondo y objetos alineados al fondo. */}
      <div className={`vn-stage ${on ? 'is-on' : ''}`}>
        <motion.div className="vn-shake" animate={shake}>
          <img className="vn-bg" src="/assets/scene1/bg-lab.png" alt="" draggable={false} />
          <div className="vn-ambient" aria-hidden="true" />
          {/* Al principio la nota está clavada en la pared (y se oscurece con la habitación). */}
          {!big && note}
          <div className="vn-dim" aria-hidden="true" />
        </motion.div>
      </div>

      {/* Después se despega y queda al frente, sobre el área visible y sin oscurecer. */}
      {big && note}

      {/* Personaje y diálogo se colocan sobre el área visible, así nunca se recortan. */}
      <Character name="turing" expression={current.expression} beat={line} talking={talking} />

      <DialogBox
        speaker="Alan Turing"
        text={current.text}
        canAdvance={!current.waitsForStart}
        onAdvance={advance}
        onTypingChange={setTalking}
      />
    </section>
  );
}
