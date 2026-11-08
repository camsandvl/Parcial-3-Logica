import type { MachineApi } from './types';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export const httpApi: MachineApi = {
  validateLanguage: (language) => post('/language/validate', language),
  validateInterpretation: (language, interpretation) =>
    post('/interpretation/validate', { language, interpretation }),
  parse: (formula, language) => post('/parse', { formula, language }),
  evaluate: (req) => post('/evaluate', req),
  history: async () => (await fetch('/api/history')).json(),
};
