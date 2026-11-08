import type {
  EvaluateRequest,
  EvaluateResponse,
  HistoryEntry,
  Interpretation,
  Language,
  ParseResponse,
  ValidateResponse,
} from '@contracts/types';

/** Lo único que las escenas conocen del backend. mockApi y httpApi lo implementan. */
export interface MachineApi {
  validateLanguage(language: Language): Promise<ValidateResponse>;
  validateInterpretation(language: Language, interpretation: Interpretation): Promise<ValidateResponse>;
  parse(formula: string, language: Language): Promise<ParseResponse>;
  evaluate(req: EvaluateRequest): Promise<EvaluateResponse>;
  history(): Promise<HistoryEntry[]>;
}
