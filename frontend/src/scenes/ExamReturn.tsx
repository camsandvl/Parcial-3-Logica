import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Character } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { SceneInfo } from '../components/vn/SceneInfo';

/**
 * Escena final: de vuelta en el salón (2026), la estudiante ya sabe cómo resolver su examen.
 * Repasa lo que aprendió con cada uno y se pone a escribir. Mario, el catedrático, entra por la
 * derecha (con el mismo recorte y contorno que los matemáticos), avisa del tiempo y mira su hoja.
 */
type Who = 'tu' | 'mario';
const LINES: Array<{ who: Who; text: string }> = [
  { who: 'tu', text: 'De vuelta en el salón… y el reloj casi no se movió. Pero ahora sí sé por dónde empezar.' },
  { who: 'tu', text: 'Primero, el lenguaje: qué símbolos hay y cuántos argumentos recibe cada uno. Eso lo aprendí con Gödel.' },
  { who: 'tu', text: 'Luego, el mundo: un dominio y lo que significa cada símbolo en él. Con Tarski entendí que la verdad depende de ese mundo.' },
  { who: 'tu', text: 'Y al final, la fórmula se evalúa parte por parte, como la máquina de Turing: un ∀ cae con un contraejemplo y un ∃ se sostiene con un testigo.' },
  { who: 'mario', text: '¡Bueno, chicos, quedan 10 minutos para entregar!' },
  { who: 'tu', text: 'Me sobran.' },
  { who: 'mario', text: 'A ver… lenguaje, interpretación y la fórmula evaluada parte por parte, con su contraejemplo. ¡Así se justifica una respuesta!' },
  { who: 'mario', text: 'Parece que alguien por fin entendió cuándo es verdadera una fórmula.' },
];
const NAMES: Record<Who, string> = { tu: 'Tú', mario: 'Mario, el catedrático' };
const MARIO_FROM = LINES.findIndex((l) => l.who === 'mario');

export function ExamReturn() {
  const navigate = useNavigate();
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const last = line === LINES.length - 1;
  const { who, text } = LINES[line];

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

      {/* Mario entra con su primera línea y se queda; rebota cuando habla */}
      {line >= MARIO_FROM && (
        <Character name="mario" side="right" className="rp-mario" expression="neutral"
          beat={who === 'mario' ? line : MARIO_FROM} talking={who === 'mario' && talking} />
      )}

      <DialogBox
        speaker={NAMES[who]}
        side={who === 'mario' ? 'right' : 'left'}
        tone={who === 'mario' ? 'mario' : undefined}
        text={text}
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
