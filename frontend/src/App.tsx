import { Navigate, Route, Routes } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="machine">
      <ControlPanel />
      <main className="stage">
        <Routes>
          <Route path="/" element={<Activation />} />
          <Route path="/lenguaje" element={<Locked module="language"><LanguageWorkshop /></Locked>} />
          <Route path="/universo" element={<Locked module="universe"><UniverseRoom /></Locked>} />
          <Route path="/consola" element={<Locked module="console"><Console /></Locked>} />
          <Route path="/informe" element={<Locked module="console"><Report /></Locked>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
