import { create } from 'zustand';
import type {
  Environment,
  EvaluateResponse,
  Interpretation,
  Language,
  ValidationError,
} from '@contracts/types';

/** Módulos de la máquina en orden de desbloqueo. */
export const MODULES = ['activation', 'language', 'universe', 'console', 'report'] as const;
export type ModuleId = (typeof MODULES)[number];
export type ModuleStatus = 'locked' | 'active' | 'error' | 'ready';

interface MachineState {
  status: Record<ModuleId, ModuleStatus>;
  language: Language;
  interpretation: Interpretation;
  formula: string;
  freeVars: string[];
  environment: Environment;
  errors: ValidationError[];
  result: EvaluateResponse | null;

  setLanguage: (l: Language) => void;
  setInterpretation: (i: Interpretation) => void;
  setFormula: (f: string) => void;
  setFreeVars: (v: string[]) => void;
  setEnvironment: (e: Environment) => void;
  setErrors: (e: ValidationError[]) => void;
  setResult: (r: EvaluateResponse | null) => void;
  markReady: (m: ModuleId) => void;
  markError: (m: ModuleId) => void;
}

const initialStatus: Record<ModuleId, ModuleStatus> = {
  activation: 'active',
  language: 'locked',
  universe: 'locked',
  console: 'locked',
  report: 'locked',
};

export const useMachine = create<MachineState>((set) => ({
  status: initialStatus,
  language: { functions: [], predicates: [] },
  interpretation: { domain: [], functions: {}, predicates: {} },
  formula: '',
  freeVars: [],
  environment: {},
  errors: [],
  result: null,

  setLanguage: (language) => set({ language }),
  setInterpretation: (interpretation) => set({ interpretation }),
  setFormula: (formula) => set({ formula }),
  setFreeVars: (freeVars) => set({ freeVars }),
  setEnvironment: (environment) => set({ environment }),
  setErrors: (errors) => set({ errors }),
  setResult: (result) => set({ result }),

  // Al validar un módulo se desbloquea el siguiente.
  markReady: (m) =>
    set((s) => {
      const status = { ...s.status, [m]: 'ready' as const };
      const next = MODULES[MODULES.indexOf(m) + 1];
      if (next && status[next] === 'locked') status[next] = 'active';
      return { status, errors: [] };
    }),
  markError: (m) => set((s) => ({ status: { ...s.status, [m]: 'error' } })),
}));
