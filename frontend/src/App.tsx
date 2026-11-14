import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ControlPanel } from './components/ControlPanel';
import { Activation } from './scenes/Activation';
import { Console } from './scenes/Console';
import { LanguageWorkshop } from './scenes/LanguageWorkshop';
import { Report } from './scenes/Report';
import { UniverseRoom } from './scenes/UniverseRoom';
import { useMachine, type ModuleId } from './store/machine';

/** Impide entrar por URL a un módulo que aún no se ha desbloqueado. */
function Locked({ module, children }: { module: ModuleId; children: React.JSX.Element }) {
  const status = useMachine((s) => s.status[module]);
  return status === 'locked' ? <Navigate to="/" replace /> : children;
}

const FADE_MS = 800;

/** Todas las escenas; se dibujan con la ubicación (ruta) de su propia capa. */
function Scenes({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Activation />} />
      <Route path="/lenguaje" element={<Locked module="language"><LanguageWorkshop /></Locked>} />
      <Route path="/universo" element={<Locked module="universe"><UniverseRoom /></Locked>} />
      <Route path="/consola" element={<Locked module="console"><Console /></Locked>} />
      <Route path="/informe" element={<Locked module="console"><Report /></Locked>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const location = useLocation();
  // Fundido cruzado entre escenas: al cambiar de ruta, la escena anterior se queda en una capa
  // que se desvanece mientras la nueva aparece encima; al terminar, la capa vieja se quita.
  const [prev, setPrev] = useState<Location | null>(null);
  const [current, setCurrent] = useState(location);

  useEffect(() => {
    if (location.pathname === current.pathname) { setCurrent(location); return; }
    setPrev(current);
    setCurrent(location);
    const id = setTimeout(() => setPrev(null), FADE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div className="machine">
      <ControlPanel />
      <main className="stage">
        {/* Misma key por ruta: al pasar de "actual" a "anterior", React conserva la escena tal
            como estaba (no la reinicia) y solo cambia su animación a desvanecerse. */}
        {[...(prev ? [prev] : []), current].map((loc) => {
          const leaving = loc === prev;
          return (
            <motion.div key={loc.pathname} className={`route-layer ${leaving ? 'is-leaving' : ''}`} aria-hidden={leaving || undefined}
              initial={prev && !leaving ? { opacity: 0 } : false}
              animate={{ opacity: leaving ? 0 : 1 }}
              transition={{ duration: FADE_MS / 1000, ease: 'easeInOut' }}>
              <Scenes location={loc} />
            </motion.div>
          );
        })}
      </main>
    </div>
  );
}
