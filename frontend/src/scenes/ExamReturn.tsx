import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DialogBox } from '../components/vn/DialogBox';
import { SceneInfo } from '../components/vn/SceneInfo';

export function ExamReturn() {
  const navigate = useNavigate();
  const [dialogue, setDialogue] = useState(0);
  const lines = [
    { speaker: 'Tú', text: 'Ahora sí, es hora de escribir la respuesta.' },
    { speaker: 'Mario, el catedrático', text: 'Bueno chicos, quedan 10 minutos para entregar!' },
  ];

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
        <motion.div
          className="return-desk"
          initial={{ y: '18%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: .7, delay: .2 }}
          aria-hidden="true"
        />
        <motion.article className="exam-paper return-paper"
          initial={{ rotate: -4, y: 20, opacity: 0 }}
          animate={{ rotate: 2, y: 0, opacity: 1 }}
          transition={{ delay: .5, type: 'spring', stiffness: 100, damping: 14 }}>
          <small>EXAMEN DE LÓGICA MATEMÁTICA</small>
          <h2>Respuesta en construcción…</h2>
          <p>Lenguaje → interpretación → evaluación</p>
          <div className="written-answer">∀x (P(x) → Q(x))</div>
        </motion.article>
        <motion.div className="writing-mark" animate={{ rotate: [-8, 8, -8], x: [-2, 2, -2] }}
          transition={{ repeat: Infinity, duration: .65 }} aria-hidden="true">✎</motion.div>
      </div>
      <DialogBox
        speaker={lines[dialogue].speaker}
        text={lines[dialogue].text}
        canAdvance={dialogue < lines.length - 1}
        onAdvance={() => setDialogue((value) => Math.min(value + 1, lines.length - 1))}
        onTypingChange={() => undefined}
      />
      <button type="button" className="exam-portal-button return-exam-button" onClick={() => navigate('/consola')}>
        Resolver el examen →
      </button>
    </section>
  );
}
