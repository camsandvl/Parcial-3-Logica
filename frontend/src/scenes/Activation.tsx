import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Guide } from '../components/Guide';
import { useMachine } from '../store/machine';

export function Activation() {
  const markReady = useMachine((s) => s.markReady);
  const navigate = useNavigate();

  const powerOn = () => {
    markReady('activation');
    navigate('/lenguaje');
  };

  return (
    <section className="scene scene-lab">
      <h2>Escena 1 · Laboratorio mecánico</h2>
      <Guide name="Turing">
        Esta máquina decide si una proposición es verdadera en un universo finito. Para funcionar necesita
        tres cosas: un lenguaje, un universo donde interpretarlo y una instrucción. Enciéndela, operador.
      </Guide>
      <motion.button
        className="power-switch"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92, rotate: 8 }}
        onClick={powerOn}
      >
        ⏻ Encender
      </motion.button>
    </section>
  );
}
