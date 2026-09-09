/**
 * Tutorial help-text parser — FID-20260909-022.
 *
 * `TutorialStep.detailedHelp` is authored as a structured template
 * (🎯 WHY / 🕐 WHEN TO USE / ⚡ HOW TO USE|EXPLORE / 💡 PRO TIP sections with
 * `•` bullets). Both tutorial UIs — the docked quest panel and the joyride
 * step windows — render it from this single parser instead of duplicating
 * the extraction logic (or, worse, printing the raw template as a wall of
 * text where every newline collapses).
 */

/** Sections extracted from a structured `detailedHelp` template. */
export interface TutorialHelpSections {
  why?: string;
  when?: string[];
  how?: string[];
  tip?: string;
}

const WHY_RE = /🎯 WHY:\s*([^\n]+)/;
const WHEN_RE = /🕐 WHEN TO USE:\s*((?:•[^\n]+\n?)+)/;
const HOW_RE = /⚡ HOW TO (?:USE|EXPLORE):\s*((?:•[^\n]+\n?)+)/;
const TIP_RE = /💡 PRO TIP:\s*([^\n]+)/;

/** Split a captured bullet block into trimmed items (one `•` per line). */
const parseBullets = (block: string): string[] =>
  block
    .split('\n')
    .filter((line) => line.trim().startsWith('•'))
    .map((line) => line.replace('•', '').trim());

/**
 * Parse a structured help template into sections. Returns `null` when the
 * text matches no section header (callers fall back to plain rendering).
 */
export const parseDetailedHelp = (detailedHelp: string): TutorialHelpSections | null => {
  if (!detailedHelp) return null;

  const sections: TutorialHelpSections = {};

  const whyMatch = detailedHelp.match(WHY_RE);
  if (whyMatch) {
    sections.why = whyMatch[1].trim();
  }

  const whenMatch = detailedHelp.match(WHEN_RE);
  if (whenMatch) {
    sections.when = parseBullets(whenMatch[1]);
  }

  const howMatch = detailedHelp.match(HOW_RE);
  if (howMatch) {
    sections.how = parseBullets(howMatch[1]);
  }

  const tipMatch = detailedHelp.match(TIP_RE);
  if (tipMatch) {
    sections.tip = tipMatch[1].trim();
  }

  return Object.keys(sections).length > 0 ? sections : null;
};
