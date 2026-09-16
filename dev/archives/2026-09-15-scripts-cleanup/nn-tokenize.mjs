// NEON NOIR mass tokenizer — converts legacy Tailwind old-skin classes to the
// nn- token language. Deterministic string mapping; idempotent (token output
// classes are never re-matched). Excludes tests.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const files = execSync(
  'git ls-files "*.tsx"',
  { encoding: 'utf8' }
).split('\n').filter(Boolean)
  .filter((f) => f.startsWith('app/') || f.startsWith('components/'))
  .filter((f) => !f.includes('__tests__'));

const GRAY = {
  bg: {
    900: 'bg-[color:var(--nn-void)]',
    800: 'bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]',
    750: 'bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)]',
    700: 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)]',
    600: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]',
    500: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]',
    400: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_22%,transparent)]',
    300: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_20%,transparent)]',
    200: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_18%,transparent)]',
    100: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_16%,transparent)]',
  },
  text: {
    50: 'text-[color:var(--nn-text-primary)]',
    100: 'text-[color:var(--nn-text-primary)]',
    200: 'text-[color:var(--nn-text-primary)]',
    300: 'text-[color:var(--nn-text-secondary)]',
    400: 'text-[color:var(--nn-text-secondary)]',
    500: 'text-[color:var(--nn-text-secondary)]',
    600: 'text-[color:var(--nn-text-secondary)]',
    700: 'text-[color:var(--nn-text-secondary)]',
    800: 'text-[color:var(--nn-text-secondary)]',
    900: 'text-[color:var(--nn-text-secondary)]',
  },
  border: {
    900: 'border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)]',
    800: 'border-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)]',
    700: 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]',
    600: 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]',
    500: 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]',
    400: 'border-[color-mix(in_oklab,var(--nn-cyan)_30%,transparent)]',
    300: 'border-[color-mix(in_oklab,var(--nn-cyan)_30%,transparent)]',
    200: 'border-[color-mix(in_oklab,var(--nn-cyan)_35%,transparent)]',
    100: 'border-[color-mix(in_oklab,var(--nn-cyan)_35%,transparent)]',
  },
};

// accent color → nn token
const ACCENT = {
  red: 'magenta', rose: 'magenta', pink: 'magenta', fuchsia: 'magenta',
  green: 'green', emerald: 'green', lime: 'green', teal: 'green',
  blue: 'cyan', cyan: 'cyan', sky: 'cyan',
  purple: 'violet', violet: 'violet', indigo: 'violet',
  amber: 'amber', yellow: 'amber', orange: 'amber',
};

function convert(src) {
  let out = src;
  let changes = 0;

  // --- gray scale ---
  for (const [prop, shades] of Object.entries(GRAY)) {
    for (const [shade, token] of Object.entries(shades)) {
      const re = new RegExp(`(^|[\\s"'\`])((?:hover:|focus:|disabled:|group-hover:)?${prop}-gray-${shade})(/[\\d]+)?(?=[\\s"'\`/])`, 'g');
      out = out.replace(re, (_m, pre) => { changes += 1; return `${pre}${token}`; });
    }
  }
  out = out.replace(/(^|[\s"'`])((?:hover:)?bg-gray-950)(\/\d+)?(?=[\s"'`/])/g, (_m, pre) => { changes += 1; return `${pre}bg-[color:var(--nn-void)]`; });
  // divide / ring / placeholder gray
  out = out.replace(/divide-gray-(\d{2,3})(\/\d+)?/g, () => { changes += 1; return 'divide-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]'; });
  out = out.replace(/ring-gray-(\d{2,3})(\/\d+)?/g, () => { changes += 1; return 'ring-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'; });
  out = out.replace(/placeholder-gray-(\d{2,3})/g, () => { changes += 1; return 'placeholder-[color:var(--nn-text-secondary)]'; });

  // --- accent colors ---
  for (const [color, token] of Object.entries(ACCENT)) {
    const v = `var(--nn-${token})`;

    // text: any shade → token color
    out = out.replace(new RegExp(`(^|[\\s"'\`])((?:hover:)?text-${color}-\\d{2,3})(/[\\d]+)?(?=[\\s"'\`])`, 'g'),
      (_m, pre) => { changes += 1; return `${pre}text-[color:${v}]`; });

    // bg: solid shades (>=500) → tinted chip; light shades → faint tint
    out = out.replace(new RegExp(`(^|[\\s"'\`])((?:hover:|focus:|disabled:)?bg-${color}-([5-9]\\d{2}))(?!\\d)(/[\\d]+)?(?=[\\s"'\`])`, 'g'),
      (_m, pre) => { changes += 1; return `${pre}bg-[color-mix(in_oklab,${v}_22%,transparent)]`; });
    out = out.replace(new RegExp(`(^|[\\s"'\`])((?:hover:|focus:|disabled:)?bg-${color}-[1-4]\\d{2})(?!\\d)(/[\\d]+)?(?=[\\s"'\`])`, 'g'),
      (_m, pre) => { changes += 1; return `${pre}bg-[color-mix(in_oklab,${v}_12%,transparent)]`; });

    // border → 50% accent mix
    out = out.replace(new RegExp(`(^|[\\s"'\`])((?:hover:)?border-${color}-\\d{2,3})(/[\\d]+)?(?=[\\s"'\`])`, 'g'),
      (_m, pre) => { changes += 1; return `${pre}border-[color-mix(in_oklab,${v}_50%,transparent)]`; });

    // gradient stops → token colors (with optional opacity suffix, incl. hover:)
    for (const stop of ['from', 'via', 'to']) {
      out = out.replace(new RegExp(`(^|[\\s"'\`])((?:hover:)?${stop})-${color}-\\d{2,3}(?!\\d)(/\\d+)?(?=[\\s"'\`])`, 'g'),
        (_m, pre, stopPart) => { changes += 1; return `${pre}${stopPart}-[color:${v}]`; });
    }
    out = out.replace(new RegExp(`hover:shadow-${color}-\\d{2,3}\\/\\d+`, 'g'),
      () => { changes += 1; return `hover:shadow-[0_0_20px_color-mix(in_oklab,${v}_40%,transparent)]`; });

    // ring accent
    out = out.replace(new RegExp(`ring-${color}-\\d{2,3}`, 'g'),
      () => { changes += 1; return `ring-[color-mix(in_oklab,${v}_50%,transparent)]`; });
  }

  // --- white/black neutrals ---
  out = out.replace(/(^|[\s"'`])text-white(?=[\s"'`/])/g, (_m, pre) => { changes += 1; return `${pre}text-[color:var(--nn-text-primary)]`; });
  out = out.replace(/(^|[\s"'`])bg-white(?=[\s"'`/])/g, (_m, pre) => { changes += 1; return `${pre}bg-[color:var(--nn-text-primary)]`; });
  out = out.replace(/(^|[\s"'`])text-black(?=[\s"'`/])/g, (_m, pre) => { changes += 1; return `${pre}text-[color:var(--nn-void)]`; });
  out = out.replace(/bg-black\/(\d+)/g, (_m, op) => { changes += 1; return `bg-[color-mix(in_oklab,var(--nn-void)_${Math.min(90, Math.round(op / 10) * 10)}%,transparent)]`; });
  out = out.replace(/bg-black(?=[\s"'`])/g, () => { changes += 1; return 'bg-[color:var(--nn-void)]'; });

  // hover:text-white → hover to primary text
  out = out.replace(/hover:text-white(?![\w-])/g, () => { changes += 1; return 'hover:text-[color:var(--nn-text-primary)]'; });

  // --- geometry: square the HUD ---
  out = out.replace(/(^|[\s"'`])rounded-(xs|sm|md|lg|xl|2xl|3xl)(?![\w-])/g, (_m, pre) => { changes += 1; return `${pre}rounded-none`; });
  out = out.replace(/(^|[\s"'`])rounded(?=[\s"'`])/g, (_m, pre) => { changes += 1; return `${pre}rounded-none`; });
  // full-width pill buttons that used rounded-full padding → square (keep rounded-full for dots/avatars is
  // indistinguishable; converting them too is acceptable — sample uses square chips)

  return { out, changes };
}

let total = 0;
const touched = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const { out, changes } = convert(src);
  if (changes > 0) {
    writeFileSync(f, out);
    total += changes;
    touched.push(`${String(changes).padStart(4)} ${f}`);
  }
}
console.log(touched.sort((a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4))).slice(0, 40).join('\n'));
console.log(`\nTOTAL replacements: ${total} across ${touched.length} files`);
