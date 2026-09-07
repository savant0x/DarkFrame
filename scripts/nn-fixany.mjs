// Codemod v2 (SAFE): only rewrites `catch (x: any)` -> `catch (x)` — no block
// parsing (the v1 brace-matcher corrupted files containing template literals).
// Resulting `.message` accesses are surfaced by tsc and fixed by hand against
// lib/errorMessage.ts's getErrorMessage helper.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const files = execSync('git ls-files "*.ts" "*.tsx"', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter((f) => f.startsWith('app/') || f.startsWith('components/') || f.startsWith('lib/'));

let catchFixed = 0;
let fetchFixed = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const orig = src;

  src = src.replace(/catch\s*\((\w+)\s*:\s*any\s*\)/g, (_m, name) => {
    catchFixed++;
    return `catch (${name})`;
  });

  // Test files: (global.fetch as any) -> typed cast
  if (f.includes('__tests__') || f.includes('.test.')) {
    src = src.replace(/\(global\.fetch as any\)/g, () => {
      fetchFixed++;
      return '(global.fetch as unknown as ReturnType<typeof vi.fn>)';
    });
  }

  if (src !== orig) writeFileSync(f, src);
}
console.log(`catch clauses fixed: ${catchFixed}, fetch casts fixed: ${fetchFixed}`);
