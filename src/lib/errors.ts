export type ErrorCode =
  | 'AI_REQUIRED'
  | 'AI_ERROR'
  | 'CANCELLED'
  | 'NO_ACTIVE_TAB'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode = 'UNKNOWN',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorCodeOf(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? (code as ErrorCode) : 'UNKNOWN';
}

export function isAIRequiredError(error: unknown): boolean {
  return errorCodeOf(error) === 'AI_REQUIRED';
}

export const AI_REQUIRED_MESSAGE =
  'Connect an AI provider first — open JobPal → AI providers, add your key (or point JobPal at a local model), then press “Save & activate”.';
