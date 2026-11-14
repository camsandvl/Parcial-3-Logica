import type { ErrorCode, Failure } from '@contracts/types';
import type { MachineApi } from './types';

/**
 * Si el backend no responde (apagado, puerto equivocado, error 500), las escenas reciben un
 * error normal en vez de quedarse esperando para siempre. El código BACKEND_UNAVAILABLE es
 * solo del frontend: no forma parte del contrato con el backend.
 */
const unavailable = (detail: string): Failure => ({
  ok: false,
  errors: [{
    code: 'BACKEND_UNAVAILABLE' as ErrorCode,
    stage: 'semantics',
    message: `la máquina no responde (${detail}). ¿Está encendido el backend en el puerto 8000?`,
  }],
});

/** ¿El error es que el backend no respondió? (para que el personaje lo diga con otras palabras) */
export const offline = (errors: Array<{ code: string }>) => errors[0]?.code === 'BACKEND_UNAVAILABLE';
export const OFFLINE_LINE = 'La máquina no responde: parece que el backend está apagado. Enciéndelo (iniciar.bat) y vuelve a intentarlo.';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`/api${path}`, init);
    if (!res.ok && res.status >= 500) return unavailable(`error ${res.status}`) as T;
    return (await res.json()) as T;
  } catch {
    return unavailable('sin conexión') as T;
  }
}

const post = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const httpApi: MachineApi = {
  validateLanguage: (language) => post('/language/validate', language),
  validateInterpretation: (language, interpretation) =>
    post('/interpretation/validate', { language, interpretation }),
  parse: (formula, language) => post('/parse', { formula, language }),
  evaluate: (req) => post('/evaluate', req),
  history: async () => {
    const res = await request<unknown>('/history');
    return Array.isArray(res) ? res : [];
  },
};
