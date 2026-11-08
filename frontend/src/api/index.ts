import { httpApi } from './httpApi';
import { mockApi } from './mockApi';
import type { MachineApi } from './types';

export const api: MachineApi = import.meta.env.VITE_USE_MOCK === 'true' ? mockApi : httpApi;
export type { MachineApi };
