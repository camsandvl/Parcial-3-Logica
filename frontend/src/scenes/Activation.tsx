import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { Character, characterImages, type Expression } from '../components/vn/Character';
import { DialogBox } from '../components/vn/DialogBox';
import { Machine } from '../components/vn/Machine';
import { useMachine } from '../store/machine';
import { SceneInfo } from '../components/vn/SceneInfo';
import { preloadImages } from '../utils/preload';

interface Line {
  expression: Expression;
  text: string;
  /** La línea espera a que el usuario pulse el botón de la nota. */
  waitsForStart?: boolean;
}

const SCRIPT: Line[] = [
  { expression: 'neutral', text: 'Bienvenido. Soy Alan Turing. Has caído en el Hut 8 de Bletchley Park, en plena guerra; no te preocupes, aquí aprenderás a operar esta máquina.' },
  { expression: 'talk', text: 'La imaginé en 1936, en un artículo: una cinta, un cabezal que lee y escribe, y unas pocas reglas. Con eso basta para seguir cualquier cálculo paso a paso.' },
  { expression: 'talk', text: 'Aquí en Bletchley la idea se pone a prueba: nuestras máquinas revisan una posibilidad tras otra, sin saltarse ninguna. Esta hará lo mismo con fórmulas de lógica de primer orden.' },
  { expression: 'talk', text: 'Después visitarás a Gödel para construir el lenguaje y a Tarski para darle significado. Sin ellos, una fórmula no puede evaluarse.' },
  { expression: 'talk', text: 'Cuando termines el recorrido, encontrarás el camino de regreso.' },
  { expression: 'talk', text: 'Pero antes hay que ponerla en marcha. Pulsa el botón.', waitsForStart: true },
  { expression: 'happy', text: '¡La máquina despertó! Como operador, seguirás cada etapa y luego regresarás al examen con las herramientas necesarias.' },
];

const LEAVE_MS = 1100; // duración de la salida hacia el Taller de Gödel

/** A partir de esta línea la nota se despega de la pared y queda al frente, grande. */
const NOTE_BIG_FROM = 1;

export function Activation() {
  const markReady = useMachine((s) => s.markReady);
  const navigate = useNavigate();
  const [briefingPage, setBriefingPage] = useState(1);
  const [briefing, setBriefing] = useState(false);
  const [line, setLine] = useState(0);
  const [on, setOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shake = useAnimationControls();
  const current = SCRIPT[line];
  const big = line >= NOTE_BIG_FROM;

  // Mientras el usuario lee, se descarga la escena 2 (Gödel y su fondo).
  useEffect(() => {
    preloadImages([...characterImages('godel'), '/assets/scene2/bg-workshop.png']);
  }, []);

  const advance = () => {
    if (line < SCRIPT.length - 1) setLine(line + 1);
    else if (!leaving) {
      // Salida animada (igual que en las otras escenas): la nota se va, Turing sale y se pasa a Gödel.
      setLeaving(true);
      setTimeout(() => {
        markReady('activation');
        navigate('/lenguaje');
      }, LEAVE_MS);
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
    <section className={`vn-scene vn-scene-turing ${on ? 'is-on' : ''}`} aria-label="Escena 1: Activación">
      <SceneInfo year={1941} photo={{ src: '/assets/notes/bletchley-park.webp', alt: 'Foto de grupo de criptoanalistas británicos; Alan Turing está sentado abajo a la izquierda', caption: 'Alan Turing (sentado, a la izquierda) con colegas criptoanalistas.' }} place="Hut 8, Bletchley Park" fact="Estamos en el Hut 8 de Bletchley Park, donde Turing dirigió al equipo que descifraba los mensajes navales de Enigma. En 1936 había imaginado la «máquina de Turing»: una cinta, un cabezal y unas pocas reglas. Era una idea, no un aparato. Aquí las máquinas sí eran reales: las «bombes», que probaban una posibilidad tras otra para hallar la clave del día. Pero solo servían para eso." />
      {/* Escenario 16:9 que cubre el área: fondo y objetos alineados al fondo. */}
      <div className={`vn-stage ${on ? 'is-on' : ''}`}>
        <motion.div className="vn-shake" animate={shake}>
          <img className="vn-bg" src="/assets/scene5/bg-hut8.png" alt="" draggable={false} />
          <div className="vn-ambient" aria-hidden="true" />
          {/* Al principio la nota está clavada en la pared (y se oscurece con la habitación). */}
          {!big && note}
          <div className="vn-dim" aria-hidden="true" />
        </motion.div>
      </div>

      {briefing && (
        <motion.div
          className="mission-briefing"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="briefing-paper">
            {briefingPage === 1 ? (
              <>
                <span className="briefing-kicker">Examen sorpresa · Salón de clases</span>
                <h2>La pregunta del examen</h2>
                <p className="briefing-lead">
                  El examen de lógica matemática está frente a ti. La pregunta pide
                  determinar cuándo una fórmula es verdadera.
                </p>
                <div className="case-file">
                  <div className="case-file-header">
                    <span>EXAMEN PARCIAL</span>
                    <span>TIEMPO RESTANTE: 05:00</span>
                  </div>
                  <div className="case-message">
                    <span className="case-message-label">Pregunta</span>
                    <strong>¿CUÁNDO ES VERDADERA UNA FÓRMULA?</strong>
                    <small>El problema pide construir un lenguaje, una interpretación y justificar el resultado.</small>
                  </div>
                  <div className="candidate-title">Lo que no tenemos claro</div>
                  <div className="candidate-grid">
                    {[
                      ['1', 'Símbolos', '¿Qué significa cada nombre?'],
                      ['2', 'Dominio', '¿Sobre qué objetos hablamos?'],
                      ['3', 'Verdad', '¿Cómo se comprueba?'],
                      ['4', 'Operaciones', 'Construye, interpreta y evalúa'],
                    ].map(([number, title, detail]) => (
                      <div className="candidate-card" key={number}>
                        <strong>{number}</strong>
                        <span>{title}</span>
                        <small>{detail}</small>
                      </div>
                    ))}
                  </div>
                  <div className="case-clue">
                    <span className="case-message-label">La anomalía</span>
                    <p>Un portal se abre en el salón. Al otro lado aparece un taller con una máquina encendida.</p>
                  </div>
                  <div className="case-conclusion">
                    <span className="case-message-label">La decisión</span>
                    <p>Al atravesarlo caerás en los talleres donde podrás resolver tus dudas.</p>
                  </div>
                </div>
                <button type="button" className="briefing-start" onClick={() => setBriefingPage(2)}>
                  Atravesar el portal <span>→</span>
                </button>
              </>
            ) : (
              <>
                <span className="briefing-kicker">Página 2 · Taller de Turing</span>
                <h2>El recorrido de aprendizaje</h2>
                <div className="briefing-flow" aria-label="Proceso de comprobación">
                  <div className="briefing-step">
                    <span className="briefing-icon">⌁</span>
                    <strong>Turing</strong>
                    <small>La máquina y el operador</small>
                  </div>
                  <span className="briefing-arrow">→</span>
                  <div className="briefing-step briefing-machine">
                    <span className="briefing-icon">G</span>
                    <strong>Gödel</strong>
                    <small>El lenguaje formal</small>
                  </div>
                  <span className="briefing-arrow">→</span>
                  <div className="briefing-step">
                    <span className="briefing-icon">T</span>
                    <strong>Tarski</strong>
                    <small>El significado y la verdad</small>
                  </div>
                </div>
                <div className="briefing-explain">
                  <strong>Tu misión como operador</strong>
                  <p>
                    Turing te enseñará cómo una máquina puede seguir pasos precisos.
                    Después Gödel te ayudará a construir el lenguaje de la fórmula y
                    Tarski a darle una interpretación para saber cuándo es verdadera.
                  </p>
                  <p>
                    Al final encontrarás un portal de regreso al salón. Allí podrás
                    resolver el examen explicando cada operación.
                  </p>
                </div>
                <small className="briefing-disclaimer">
                  La historia es una aventura educativa: los personajes y el portal
                  sirven para conectar los conceptos con el ejercicio del examen.
                </small>
                <button type="button" className="briefing-start" onClick={() => setBriefing(false)}>
                  Entrar al taller de Turing <span>→</span>
                </button>
                <button type="button" className="briefing-back" onClick={() => setBriefingPage(1)}>← Volver al salón</button>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Después se despega y queda al frente, sobre el área visible y sin oscurecer. */}
      {!briefing && big && (
        <motion.div className="vn-note-exit" animate={leaving ? { x: '30%', y: '-20%', scale: 0.4, rotate: 10, opacity: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.5, 0, 0.75, 0] }}>
          {note}
        </motion.div>
      )}

      {/* Personaje y diálogo se colocan sobre el área visible, así nunca se recortan. */}
      {!briefing && <Character name="turing" expression={current.expression} beat={line} talking={talking} leaving={leaving} />}

      {!briefing && <motion.div className="vn-dialog-wrap" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.4, delay: leaving ? 0.5 : 0 }}>
      <DialogBox
        speaker="Alan Turing"
        text={current.text}
        canAdvance={!current.waitsForStart}
        onAdvance={advance}
        onTypingChange={setTalking}
      />
      </motion.div>}
    </section>
  );
}
