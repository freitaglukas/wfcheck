export class HarnessError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'HarnessError'; }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown infrastructure failure';
}
