/**
 * FID-20260911-044 — battle report text → structured sections.
 *
 * `formatBattleResultMessage` (lib/battleNotification.ts) ships a deterministic
 * line-item report. This parser reconstructs it into typed sections so the
 * inbox can render a styled battle card instead of a text wall. Pure string
 * ops — no DB, no imports — so it is trivially unit-testable and safe on the
 * client.
 *
 * Defensive by design: every accessor tolerates missing/malformed lines and
 * callers can hand raw arbitrary text (it round-trips as a single body block).
 */

export interface BattleReportUnitLine {
  name: string;
  qty: number;
  str: number;
  def: number;
}

export interface BattleReportForce {
  side: 'attacker' | 'defender';
  username: string;
  units: BattleReportUnitLine[];
  totalStr: number | null;
  totalDef: number | null;
  hpStart: number | null;
  hpEnd: number | null;
}

export interface BattleReportRound {
  roundNumber: number;
  attackerDamage: number | null;
  defenderDamage: number | null;
  attackerHP: number | null;
  defenderHP: number | null;
  attackerLost: number | null;
  defenderLost: number | null;
}

export interface BattleReportResultLine {
  text: string;
}

export interface BattleReport {
  /** `⚔️ BATTLE REPORT — {battleType} at ({x}, {y}) — {outcome}` */
  headline: string;
  battleType: string | null;
  location: { x: number; y: number } | null;
  /** VICTORY | DEFEAT | DRAW — null when the headline is non-standard. */
  outcome: 'VICTORY' | 'DEFEAT' | 'DRAW' | null;
  timestamp: string | null;
  battleId: string | null;
  totalRounds: number | null;
  forces: BattleReportForce[];
  rounds: BattleReportRound[];
  /** Lines under 💀 CASUALTIES & RESULTS (casualties, captures, plunder, XP, notes). */
  results: BattleReportResultLine[];
  /** Sections present in the source text but unknown to this parser. */
  unknownSections: string[];
  /** True when at least the headline + one known section parsed. */
  parsed: boolean;
}

/** Strip trailing "· R<n> —"-safe comma-number: "1,234" → 1234. */
function toInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw.replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Split on section headers while keeping the header with its body. */
function splitSections(content: string): { header: string | null; body: string[] }[] {
  const sections: { header: string | null; body: string[] }[] = [];
  let current: { header: string | null; body: string[] } = { header: null, body: [] };
  for (const line of content.split('\n')) {
    // Alternation, not a character class: astral-plane emoji (📋 U+1F4CB) are
    // surrogate pairs — `[📋]` matches a single code unit and breaks on \s.
    const isHeader = /^(?:📋|🎲|💀)\s/.test(line);
    if (isHeader) {
      if (current.header !== null || current.body.some(l => l.trim() !== '')) {
        sections.push(current);
      }
      current = { header: line, body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.header !== null || current.body.some(l => l.trim() !== '')) {
    sections.push(current);
  }
  return sections;
}

function parseForceLine(line: string): { side: 'attacker' | 'defender'; username: string } | null {
  const m = line.match(/^\s*(🎯|🛡)\s+(Attacker|Defender):\s*(.+)$/);
  if (!m) return null;
  return { side: m[2] === 'Attacker' ? 'attacker' : 'defender', username: m[3].trim() };
}

function parseUnitLine(line: string): BattleReportUnitLine | null {
  // "  • INFANTRY ×10,725 — STR 1,072,500 / DEF 0"
  const m = line.match(/^\s*•\s+(.+?)\s+×([\d,]+)\s+—\s+STR\s+([\d,]+)\s*\/\s*DEF\s+([\d,]+)\s*$/);
  if (!m) return null;
  return {
    name: m[1].trim(),
    qty: toInt(m[2]) ?? 0,
    str: toInt(m[3]) ?? 0,
    def: toInt(m[4]) ?? 0,
  };
}

function parseTotalLine(line: string): { str: number | null; def: number | null; hpStart: number | null; hpEnd: number | null } | null {
  // "  • Total STR 1,340,625 · DEF 0 · HP 107,250 → 0"
  const m = line.match(
    /^\s*•\s+Total\s+STR\s+([\d,]+)?\s*·\s*DEF\s+([\d,]+)?\s*·\s*HP\s+([\d,]+)?\s*(?:→|->)\s*([\d,]+)?\s*$/i,
  );
  if (!m) return null;
  return {
    str: toInt(m[1]),
    def: toInt(m[2]),
    hpStart: toInt(m[3]),
    hpEnd: toInt(m[4]),
  };
}

function parseRoundLine(line: string): BattleReportRound | null {
  // "  R1: A dealt 5 / D dealt 2,081,767 — HP 0 vs 313,970 — losses A 10725 / D 0"
  const m = line.match(
    /^\s*R(\d+):\s*A\s+dealt\s+([\d,]+)?\s*\/\s*D\s+dealt\s+([\d,]+)?\s*—\s*HP\s+([\d,]+)?\s+vs\s+([\d,]+)?\s*—\s*losses\s+A\s+([\d,]+)?\s*\/\s*D\s+([\d,]+)?\s*$/i,
  );
  if (!m) return null;
  return {
    roundNumber: toInt(m[1]) ?? 0,
    attackerDamage: toInt(m[2]),
    defenderDamage: toInt(m[3]),
    attackerHP: toInt(m[4]),
    defenderHP: toInt(m[5]),
    attackerLost: toInt(m[6]),
    defenderLost: toInt(m[7]),
  };
}

/**
 * Parse a battle_result message body into structured sections.
 * Non-report text parses with `parsed: false` and round-trips via `headline`.
 */
export function parseBattleReport(content: string): BattleReport {
  const lines = content.split('\n');
  const headline = lines[0]?.trim() ?? '';

  const report: BattleReport = {
    headline,
    battleType: null,
    location: null,
    outcome: null,
    timestamp: null,
    battleId: null,
    totalRounds: null,
    forces: [],
    rounds: [],
    results: [],
    unknownSections: [],
    parsed: false,
  };

  // Headline: "⚔️ BATTLE REPORT — FACTORY at (44, 2) — DEFEAT"
  const hm = headline.match(
    /^⚔️\s*BATTLE REPORT\s+—\s+(.+?)\s+at\s+\(?(?:(\d+),\s*(\d+)|the field)\)?\s+—\s+(VICTORY|DEFEAT|DRAW)\s*$/i,
  );
  if (hm) {
    report.battleType = hm[1].trim();
    if (hm[2] !== undefined && hm[3] !== undefined) {
      report.location = { x: Number.parseInt(hm[2], 10), y: Number.parseInt(hm[3], 10) };
    }
    const out = hm[4].toUpperCase();
    report.outcome = out === 'VICTORY' || out === 'DEFEAT' || out === 'DRAW' ? out : null;
  }

  // Meta line: "🗓 9/11/2026, 1:37:37 PM · Battle ID BATTLE-17891 · 1 round"
  const meta = lines[1]?.trim() ?? '';
  const mm = meta.match(/^🗓\s*(.+?)\s*·\s*Battle ID\s+(\S+)\s*·\s*(\d+)\s+round/i);
  if (mm) {
    report.timestamp = mm[1].trim();
    report.battleId = mm[2].trim();
    report.totalRounds = toInt(mm[3]);
  }

  const sections = splitSections(content);
  for (const section of sections) {
    if (section.header === null) continue; // headline/meta — handled above
    if (section.header.startsWith('📋')) {
      let currentForce: BattleReportForce | null = null;
      for (const line of section.body) {
        const forceLine = parseForceLine(line);
        if (forceLine) {
          currentForce = {
            side: forceLine.side,
            username: forceLine.username,
            units: [],
            totalStr: null,
            totalDef: null,
            hpStart: null,
            hpEnd: null,
          };
          report.forces.push(currentForce);
          continue;
        }
        const total = parseTotalLine(line);
        if (total && currentForce) {
          currentForce.totalStr = total.str;
          currentForce.totalDef = total.def;
          currentForce.hpStart = total.hpStart;
          currentForce.hpEnd = total.hpEnd;
          continue;
        }
        const unit = parseUnitLine(line);
        if (unit && currentForce) {
          currentForce.units.push(unit);
        }
        // Anything else under FORCES is ignored (blank lines etc.).
      }
    } else if (section.header.startsWith('🎲')) {
      for (const line of section.body) {
        const round = parseRoundLine(line);
        if (round) report.rounds.push(round);
      }
    } else if (section.header.startsWith('💀')) {
      for (const line of section.body) {
        // Only the generator's bullet lines and ℹ️ notes are results —
        // anything else (e.g. appended junk) is ignored, keeping the card clean.
        if (!/^\s*(•|ℹ️)/.test(line)) continue;
        report.results.push({ text: line.trim().replace(/^•\s*/, '') });
      }
    } else {
      report.unknownSections.push(section.header);
    }
  }

  report.parsed =
    hm !== null &&
    report.forces.length > 0 &&
    (report.rounds.length > 0 || report.results.length > 0);

  return report;
}
