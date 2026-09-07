/**
 * Extract a readable message from an unknown thrown value.
 * Used across services/components after the `no-explicit-any` cleanup —
 * catch variables are `unknown` under strict mode.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
