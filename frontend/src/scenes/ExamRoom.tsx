import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    '¿Y eso? Justo a tu lado se abrió un portal que gira y brilla… parece llevar a otra época. Tal vez ahí puedas verlos pensar.',
  ];

  const portalOpen = line === SCRIPT.length - 1;

  const enterPortal = () => {
    markReady('activation');
    navigate('/turing');
  };

  return (
    <section className="vn-scene vn-scene-exam" aria-label="Escena inicial: examen de lógica">
      <SceneInfo year={2026}
        place="Salón de clases · Examen parcial"
        fact="El salón es el punto de partida: los estudiantes conocen los símbolos, pero todavía no dominan cómo construir una interpretación ni comprobar una fórmula."
      />
      <div className="vn-stage exam-stage">
        <img className="vn-bg" src="/assets/scene0/bg-classroom.webp" alt="" draggable={false} />
        {/* La estudiante, en primer plano: el borde de abajo la corta debajo del tablero. Cuando se
            abre el portal cambia a la cara de susto (mismo encuadre: las dos calzan pixel a pixel). */}
        <motion.div className="scene0-student"
          initial={{ opacity: 0, y: '2%' }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}>
          <motion.div animate={portalOpen ? { y: ['0%', '-2.5%', '0%'] } : { y: '0%' }} transition={{ duration: 0.35, ease: 'easeOut' }}>
            <motion.img src="/assets/scene0/student.webp" alt={portalOpen ? '' : 'Una estudiante, preocupada, frente a su examen'} draggable={false}
              animate={{ opacity: portalOpen ? 0 : 1 }} transition={{ duration: 0.2 }} />
            <motion.img src="/assets/scene0/student-shocked.webp" alt={portalOpen ? 'La estudiante, asustada, mira hacia el portal' : ''} draggable={false}
              initial={{ opacity: 0 }} animate={{ opacity: portalOpen ? 1 : 0 }} transition={{ duration: 0.2 }} />
          </motion.div>
        </motion.div>
        {/* El portal es el mismo remolino del salto en el tiempo: se abre girando y respira */}
        <motion.div
          className="exam-portal"
          initial={{ opacity: 0, scale: 0 }}
          animate={portalOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
          transition={{ type: 'spring', stiffness: 70, damping: 13 }}
          aria-hidden="true"
        >
          <img className="exam-portal-swirl" src="/assets/fx/time-swirl.webp" alt="" draggable={false} />
        </motion.div>
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
