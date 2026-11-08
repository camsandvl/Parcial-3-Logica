// Contratos compartidos entre frontend (Camila), sintaxis (Emily) y semántica (Ale).
// Cualquier cambio aquí requiere aprobación de los tres.

export type Element = string;

// ---------- Lenguaje ----------
export interface SymbolDecl {
  name: string;
  arity: number; // funciones: >= 0 (0 = constante) · predicados: >= 1
}

export interface Language {
  functions: SymbolDecl[];
  predicates: SymbolDecl[];
}

// ---------- Interpretación ----------
/** Fila de la tabla de una función: [argumentos, valor] */
export type FunctionRow = [Element[], Element];

export interface Interpretation {
  domain: Element[];
  functions: Record<string, FunctionRow[]>;
  predicates: Record<string, Element[][]>;
}

/** Asignación de variables libres a elementos de D */
export type Environment = Record<string, Element>;

// ---------- AST ----------
export type Span = [number, number];

export type Term =
  | { type: 'var'; name: string; span: Span }
  | { type: 'func'; name: string; args: Term[]; span: Span };

export type Formula =
  | { type: 'pred'; name: string; args: Term[]; span: Span }
  | { type: 'not'; body: Formula; span: Span }
  | { type: 'and' | 'or' | 'implies' | 'iff'; left: Formula; right: Formula; span: Span }
  | { type: 'forall' | 'exists'; var: string; body: Formula; span: Span };

// ---------- Errores ----------
export type ErrorCode =
  | 'SYNTAX_ERROR'
  | 'UNKNOWN_SYMBOL'
  | 'ARITY_MISMATCH'
  | 'INVALID_LANGUAGE'
  | 'EMPTY_DOMAIN'
  | 'DUPLICATE_ELEMENT'
  | 'FUNCTION_INCOMPLETE'
  | 'FUNCTION_VALUE_OUT_OF_DOMAIN'
  | 'EMPTY_RELATION'
  | 'TUPLE_OUT_OF_DOMAIN'
  | 'TUPLE_WRONG_ARITY'
  | 'MISSING_ASSIGNMENT'
  | 'ASSIGNMENT_OUT_OF_DOMAIN';

export type Stage = 'language' | 'interpretation' | 'syntax' | 'environment' | 'semantics';

export interface ValidationError {
  code: ErrorCode;
  stage: Stage;
  message: string;
  span?: Span;
  /** Dónde está el error en la entrada, p. ej. "formula", "functions.f", "predicates.R[2]" */
  path?: string;
}

export interface Failure {
  ok: false;
  errors: ValidationError[];
}

// ---------- Respuestas ----------
export type ValidateResponse = { ok: true } | Failure;

export type ParseResponse =
  | { ok: true; ast: Formula; freeVars: string[] }
  | Failure;

export type TraceKind = 'witness' | 'counterexample' | 'full_check' | 'connective' | 'atomic';

export interface TraceNode {
  node: Formula['type'];
  value: boolean;
  kind: TraceKind;
  span: Span;
  text?: string; // sub-fórmula impresa
  var?: string; // solo cuantificadores
  checked?: Array<Record<string, Element> & { value: boolean }>;
  decisive?: Record<string, Element>;
  children: TraceNode[];
}

export type EvaluateResponse =
  | { ok: true; value: boolean; summary: string; trace: TraceNode }
  | Failure;

export interface EvaluateRequest {
  language: Language;
  interpretation: Interpretation;
  formula: string;
  environment: Environment;
}

export interface HistoryEntry {
  id: number;
  createdAt: string;
  formula: string;
  value: boolean | null;
  summary: string;
}
