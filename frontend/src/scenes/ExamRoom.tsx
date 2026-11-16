import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneInfo } from '../components/vn/SceneInfo';
import { useMachine } from '../store/machine';

export function ExamRoom() {
  const navigate = useNavigate();
  const markReady = useMachine((s) => s.markReady);

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
      <div className="vn-stage">
        <img className="vn-bg" src="/assets/scene3/bg-classroom.png" alt="" draggable={false} />
        <motion.div
          className="exam-portal"
          animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.04, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          aria-hidden="true"
        >
          <span>∃</span>
          <span>∀</span>
          <span>→</span>
        </motion.div>
        <div className="exam-board">
          <small>EXAMEN DE LÓGICA MATEMÁTICA</small>
          <strong>¿Cuándo es verdadera una fórmula?</strong>
          <span>Dominio · lenguaje · interpretación</span>
        </div>
      </div>
      <button type="button" className="exam-portal-button" onClick={enterPortal}>
        Entrar al portal →
      </button>
    </section>
  );
}
