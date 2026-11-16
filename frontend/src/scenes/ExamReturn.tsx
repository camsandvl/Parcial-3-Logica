import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DialogBox } from '../components/vn/DialogBox';
import { SceneInfo } from '../components/vn/SceneInfo';

export function ExamReturn() {
  const navigate = useNavigate();

  return (
    <section className="vn-scene vn-scene-exam-return" aria-label="Regreso al examen">
      <SceneInfo
        place="Salón de clases · Regreso"
        fact="El estudiante vuelve al mismo salón con una forma de resolver la pregunta: primero se define el lenguaje, luego la interpretación y finalmente se evalúa la fórmula."
      />
      <div className="vn-stage">
        <img className="vn-bg" src="/assets/scene3/bg-classroom.png" alt="" draggable={false} />
        <motion.div
          className="return-portal"
          initial={{ opacity: 1, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: .8 }}
          aria-hidden="true"
        />
        <div className="exam-student" aria-label="Estudiante de regreso en el salón" />
        <div className="exam-board return-board">
          <small>EXAMEN DE LÓGICA MATEMÁTICA</small>
          <strong>Respuesta en construcción…</strong>
          <span>El estudiante organiza la solución con lo aprendido.</span>
        </div>
      </div>
      <DialogBox
        speaker="Mario, el catedrático"
        text="¡Regresaste! Quedan cinco minutos nada más. Ahora resuelve la pregunta explicando el lenguaje, la interpretación y por qué tu fórmula es verdadera o falsa."
        canAdvance={false}
        onAdvance={() => undefined}
        onTypingChange={() => undefined}
      />
      <button type="button" className="exam-portal-button return-exam-button" onClick={() => navigate('/consola')}>
        Resolver el examen →
      </button>
    </section>
  );
}
