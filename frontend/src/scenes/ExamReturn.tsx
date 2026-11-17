import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DialogBox } from '../components/vn/DialogBox';
import { SceneInfo } from '../components/vn/SceneInfo';

/**
 * Escena final: de vuelta en el salón (2026), la estudiante ya sabe cómo resolver su examen.
 * Repasa en voz baja lo que aprendió con cada uno y se pone a escribir. Fin del viaje.
 */
const LINES = [
  { speaker: 'Tú', text: 'De vuelta en el salón… y el reloj casi no se movió. Pero ahora sí sé por dónde empezar.' },
  { speaker: 'Tú', text: 'Primero, el lenguaje: qué símbolos hay y cuántos argumentos recibe cada uno. Eso lo aprendí con Gödel.' },
  { speaker: 'Tú', text: 'Luego, el mundo: un dominio y lo que significa cada símbolo en él. Con Tarski entendí que la verdad depende de ese mundo.' },
  { speaker: 'Tú', text: 'Y al final, la fórmula se evalúa parte por parte, como la máquina de Turing: un ∀ cae con un contraejemplo y un ∃ se sostiene con un testigo.' },
  { speaker: 'Mario, el catedrático', text: '¡Bueno, chicos, quedan 10 minutos para entregar!' },
  { speaker: 'Tú', text: 'Me sobran.' },
];

export function ExamReturn() {
  const navigate = useNavigate();
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const last = line === LINES.length - 1;

  return (
    <section className="vn-scene vn-scene-exam vn-scene-exam-return" aria-label="Escena final: regreso al examen">
      <SceneInfo year={2026}
        place="Salón de clases · Regreso"
        fact="De vuelta en el mismo salón. Para resolver la pregunta del examen se sigue el mismo camino del viaje: primero se define el lenguaje, luego la interpretación y finalmente se evalúa la fórmula, con testigos y contraejemplos."
      />
      <div className="vn-stage exam-stage">
        <img className="vn-bg" src="/assets/scene0/bg-classroom.webp" alt="" draggable={false} />
        <motion.div className="scene0-student"
          initial={{ opacity: 0, y: '2%' }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}>
          <img src="/assets/scene0/student-confident.webp" alt="La estudiante, de vuelta en su escritorio, contenta y segura con su examen" draggable={false} />
        </motion.div>
      </div>
      <DialogBox
        speaker={LINES[line].speaker}
        text={LINES[line].text}
        canAdvance={!talking && !last}
        onAdvance={() => setLine((value) => Math.min(value + 1, LINES.length - 1))}
        onTypingChange={setTalking}
      />
      {last && !talking && (
        <motion.button type="button" className="exam-portal-button exam-end-button" onClick={() => navigate('/')}
          initial={{ opacity: 0, y: 14, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
          Fin · Volver a la portada
        </motion.button>
      )}
    </section>
  );
}
