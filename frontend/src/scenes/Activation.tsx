import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { Character, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { Lever } from '../components/vn/Lever';
import { Machine } from '../components/vn/Machine';
import { useMachine } from '../store/machine';

interface Line {
  expression: Expression;
  text: string;
  /** La línea espera a que el usuario jale la palanca. */
  waitsForLever?: boolean;
}

const SCRIPT: Line[] = [
  { expression: 'neutral', text: 'Ah, por fin, un operador. Soy Alan Turing, y esta es mi máquina más ambiciosa.' },
  { expression: 'talk', text: 'Evalúa fórmulas de lógica de primer orden. Pero una fórmula solo es verdadera o falsa dentro de un mundo concreto: una interpretación.' },
  { expression: 'talk', text: 'Con Gödel declararás el lenguaje: funciones y predicados con su aridad. Con Tarski construirás el mundo: un dominio y el significado de cada símbolo.' },
  { expression: 'talk', text: 'Después escribirás la fórmula, y te diré si es verdadera o falsa, con un testigo o un contraejemplo como prueba.' },
  { expression: 'talk', text: 'Pero antes hay que despertarla. Jala la palanca.', waitsForLever: true },
  { expression: 'happy', text: '¡Escucha cómo zumba! Vamos al taller de Gödel.' },
];

export function Activation() {
  const markReady = useMachine((s) => s.markReady);
  const navigate = useNavigate();
  const [line, setLine] = useState(0);
  const [on, setOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const shake = useAnimationControls();
  const current = SCRIPT[line];

  const advance = () => {
    if (line < SCRIPT.length - 1) setLine(line + 1);
    else {
      markReady('activation');
      navigate('/lenguaje');
    }
  };

  const pullLever = () => {
    setOn(true);
    // Sacudida de la habitación cuando arranca el motor.
    void shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.45, delay: 0.15 } });
    setTimeout(() => setLine(line + 1), 2200);
  };

  return (
    <section className="vn-scene" aria-label="Escena 1: Activación">
      {/* Escenario 16:9 que cubre el área: fondo y objetos alineados al fondo. */}
      <div className={`vn-stage ${on ? 'is-on' : ''}`}>
        <motion.div className="vn-shake" animate={shake}>
          <img className="vn-bg" src="/assets/scene1/bg-lab.png" alt="" draggable={false} />
          <div className="vn-chalk" aria-hidden="true">∀x ( P(x) → ∃y R(x, y) )</div>

          {/* Luz verde de la máquina sobre la habitación. */}
          <div className="vn-ambient" aria-hidden="true" />

          <Machine on={on} screenText={on ? 'SISTEMA\nLISTO' : undefined} />
          <Lever down={on} enabled={!!current.waitsForLever} onPull={pullLever} />
          <div className="vn-dim" aria-hidden="true" />
        </motion.div>
      </div>

      {/* Personaje y diálogo se colocan sobre el área visible, así nunca se recortan. */}
      <Character name="turing" expression={current.expression} beat={line} talking={talking} />

      <DialogBox
        speaker="Alan Turing"
        text={current.text}
        canAdvance={!current.waitsForLever}
        onAdvance={advance}
        onTypingChange={setTalking}
      />
    </section>
  );
}
