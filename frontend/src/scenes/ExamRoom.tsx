import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DialogBox } from '../components/vn/DialogBox';
import { SceneInfo } from '../components/vn/SceneInfo';
import { useMachine } from '../store/machine';

export function ExamRoom() {
  const navigate = useNavigate();
  const markReady = useMachine((s) => s.markReady);
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);

  const SCRIPT = [
    'Parcial de lógica matemática. La hoja está frente a ti y, siendo honestos, no sabes por dónde empezar.',
    'Te preguntas cómo Turing, Gödel y Tarski lograron convertir preguntas tan abstractas en algo que una máquina pudiera comprobar.',
    'Tal vez no necesitas memorizar sus nombres. Tal vez necesitas ver cómo pensaban.',
  ];

  const enterPortal = () => {
    markReady('activation');
    navigate('/turing');
  };

  return (
    <section className="vn-scene vn-scene-exam" aria-label="Escena inicial: examen de lógica">
      <SceneInfo
        place="Salón de clases · Examen parcial"
        fact="El salón es el punto de partida: los estudiantes conocen los símbolos, pero todavía no dominan cómo construir una interpretación ni comprobar una fórmula."
      />
      <div className="vn-stage exam-stage">
        <img className="vn-bg" src="/assets/scene3/bg-classroom.png" alt="" draggable={false} />
        <motion.div
          className="exam-desk"
          initial={{ y: '18%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: .8, ease: 'easeOut' }}
          aria-hidden="true"
        />
        <motion.article
          className="exam-paper"
          initial={{ rotate: -8, x: '-8%', y: '12%', opacity: 0 }}
          animate={{ rotate: -2, x: 0, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 15, delay: .25 }}
        >
          <span className="paper-clip" />
          <small>PARCIAL · LÓGICA MATEMÁTICA</small>
          <h2>¿Cuándo es verdadera una fórmula?</h2>
          <p>Define el lenguaje, interpreta el universo y justifica el valor de verdad.</p>
          <div className="paper-lines" aria-hidden="true"><i /><i /><i /></div>
        </motion.article>
        <motion.div
          className="exam-portal"
          initial={{ opacity: 0, scale: .2 }}
          animate={line === SCRIPT.length - 1 ? { opacity: [0, 1, .7, 1], scale: [0.2, 1.08, 1] } : { opacity: 0, scale: .2 }}
          transition={{ duration: 1.2, repeat: line === SCRIPT.length - 1 ? Infinity : 0, repeatDelay: .7 }}
          aria-hidden="true"
        >
          <span>∃</span>
          <span>∀</span>
          <span>→</span>
        </motion.div>
        <AnimatePresence>
          {line === SCRIPT.length - 1 && (
            <motion.div className="portal-caption" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>Una salida imposible se abre en el aula.</span>
              <b>El portal te está esperando.</b>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <DialogBox
        speaker="Tú"
        text={SCRIPT[line]}
        canAdvance={!talking && line < SCRIPT.length - 1}
        onAdvance={() => setLine((value) => Math.min(value + 1, SCRIPT.length - 1))}
        onTypingChange={setTalking}
      />
      {line === SCRIPT.length - 1 && !talking && (
        <motion.button type="button" className="exam-portal-button" onClick={enterPortal}
          initial={{ opacity: 0, y: 14, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
          Entrar al portal →
        </motion.button>
      )}
    </section>
  );
}
