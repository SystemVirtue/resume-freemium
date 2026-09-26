/**
 * Fence escaping lives in a module of its own so the letter prompt, the planner
 * and the critic can each build a prompt without importing one another in a
 * circle.
 *
 * User-supplied text can never close the fence that isolates it. Stripping the
 * delimiters keeps a pasted ad from breaking out of its block and posing as an
 * instruction from the app.
 */
export function escapeFences(text: string): string {
  return (text || '').replace(/<{2,}/g, '<').replace(/>{2,}/g, '>');
}
