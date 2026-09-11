/**
 * @file components/messaging/BattleReportCard.tsx
 * @overview FID-20260911-044 — styled battle report card for `battle_result`
 * system messages in the inbox (replaces the raw 1–3.8 KB text wall).
 *
 * Renders the deterministic report text produced by
 * `lib/battleNotification.formatBattleResultMessage` through the pure parser
 * `lib/battleReportParser.parseBattleReport`. Falls back to the raw text
 * whenever the parser flags the body as non-report (`parsed: false`), so
 * hand-edited or legacy rows can never render an empty card.
 *
 * NEON NOIR: outcome-tinted border/head (green VICTORY, magenta DEFEAT,
 * amber DRAW), collapsible detail, outcome-perspective plunder lines.
 */

import { useMemo, useState } from 'react';
import type { Message } from '@/types/messaging.types';
import {
  parseBattleReport,
  type BattleReportForce,
  type BattleReportResultLine,
} from '@/lib/battleReportParser';

const OUTCOME_CLASS: Record<string, string> = {
  VICTORY: 'nn-battle-report--victory',
  DEFEAT: 'nn-battle-report--defeat',
  DRAW: 'nn-battle-report--draw',
};

/** Outcome glyph + label for the header chip. */
function outcomeChip(report: ReturnType<typeof parseBattleReport>): { glyph: string; label: string } {
  switch (report.outcome) {
    case 'VICTORY': return { glyph: '🏆', label: 'VICTORY' };
    case 'DEFEAT': return { glyph: '☠️', label: 'DEFEAT' };
    case 'DRAW': return { glyph: '🤝', label: 'DRAW' };
    default: return { glyph: '⚔️', label: 'REPORT' };
  }
}

function ForceColumn({ force }: { force: BattleReportForce }) {
  return (
    <div className={`nn-battle-report__force nn-battle-report__force--${force.side}`}>
      <div className="nn-battle-report__force-name" title={force.username}>
        {force.side === 'attacker' ? '🎯' : '🛡'} {force.username}
      </div>
      {force.units.length > 0 && (
        <div className="nn-battle-report__units">
          {force.units.map((u, i) => (
            <div
              key={`${u.name}-${i}`}
              className={`nn-battle-report__unit ${
                u.str > 0 && u.def === 0 ? 'nn-battle-report__unit--off' : ''
              } ${u.def > 0 && u.str === 0 ? 'nn-battle-report__unit--def' : ''}`}
            >
              <b title={u.name}>{u.name} ×{u.qty.toLocaleString()}</b>
              <span>
                {u.str > 0 ? `${u.str.toLocaleString()} STR` : ''}
                {u.str > 0 && u.def > 0 ? ' · ' : ''}
                {u.def > 0 ? `${u.def.toLocaleString()} DEF` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="nn-battle-report__total">
        <span>
          {force.totalStr !== null ? `${force.totalStr.toLocaleString()} STR` : ''}
          {force.totalStr !== null && force.totalDef !== null ? ' · ' : ''}
          {force.totalDef !== null ? `${force.totalDef.toLocaleString()} DEF` : ''}
        </span>
        {force.hpStart !== null && force.hpEnd !== null && (
          <span className="nn-battle-report__hp">
            HP {force.hpStart.toLocaleString()} → {force.hpEnd.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

function RoundRow({ round }: { round: ReturnType<typeof parseBattleReport>['rounds'][number] }) {
  return (
    <div className="nn-battle-report__round">
      <span className="nn-battle-report__round-r">R{round.roundNumber}</span>
      <span className="nn-battle-report__dmg-a">A {round.attackerDamage !== null ? round.attackerDamage.toLocaleString() : '—'}</span>
      <span className="nn-battle-report__dmg-d">D {round.defenderDamage !== null ? round.defenderDamage.toLocaleString() : '—'}</span>
      <span className="nn-battle-report__round-sub">
        {round.attackerHP !== null && round.defenderHP !== null
          ? `HP ${round.attackerHP.toLocaleString()} vs ${round.defenderHP.toLocaleString()}`
          : ''}
        {round.attackerLost !== null && round.defenderLost !== null
          ? ` · losses ${round.attackerLost.toLocaleString()} / ${round.defenderLost.toLocaleString()}`
          : ''}
      </span>
    </div>
  );
}

/** Plunder/capture lines tinted by gain/loss keywords. */
function resultClass(line: BattleReportResultLine): string {
  if (/^💰|plundered|captured units|XP —/i.test(line.text) && !/^📉/.test(line.text)) {
    return 'nn-battle-report__result--gain';
  }
  if (/^📉|lost .* to the raider/i.test(line.text)) {
    return 'nn-battle-report__result--loss';
  }
  return '';
}

export function BattleReportCard({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(true);
  const report = useMemo(() => parseBattleReport(message.content), [message.content]);

  // Defensive fallback: a battle_result row whose body no longer parses
  // renders exactly as before (raw text) — never an empty card.
  if (!report.parsed) {
    return (
      <div className="nn-battle-report">
        <div className="nn-battle-report__head">
          <span className="nn-battle-report__title"><span>⚔️</span><span>BATTLE REPORT</span></span>
        </div>
        <div className="nn-battle-report__body">
          <p className="text-sm whitespace-pre-wrap break-words text-[color:var(--nn-text-primary)]">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  const chip = outcomeChip(report);

  return (
    <div className={`nn-battle-report ${OUTCOME_CLASS[report.outcome ?? ''] ?? ''} ${expanded ? '' : 'nn-battle-report--collapsed'}`}>
      <div className="nn-battle-report__head">
        <span className="nn-battle-report__title">
          <span>{chip.glyph}</span>
          <span>
            {report.battleType ?? 'BATTLE'}
            {report.location ? ` (${report.location.x}, ${report.location.y})` : ''}
          </span>
        </span>
        <span className="nn-battle-report__meta">{chip.label}</span>
      </div>

      <div className="nn-battle-report__body">
        {(report.timestamp || report.battleId || report.totalRounds !== null) && (
          <div className="nn-battle-report__meta">
            {report.timestamp ?? ''}
            {report.timestamp && report.battleId ? ' · ' : ''}
            {report.battleId ? `ID ${report.battleId}` : ''}
            {report.totalRounds !== null ? ` · ${report.totalRounds} round${report.totalRounds === 1 ? '' : 's'}` : ''}
          </div>
        )}

        {report.forces.length > 0 && (
          <div>
            <div className="nn-battle-report__section-head">FORCES COMMITTED</div>
            <div className="nn-battle-report__forces">
              {report.forces.map((f) => <ForceColumn key={f.side} force={f} />)}
            </div>
          </div>
        )}

        {report.rounds.length > 0 && (
          <div>
            <div className="nn-battle-report__section-head">ROUND-BY-ROUND</div>
            <div className="nn-battle-report__rounds">
              {report.rounds.map((r) => <RoundRow key={r.roundNumber} round={r} />)}
            </div>
          </div>
        )}

        {report.results.length > 0 && (
          <div>
            <div className="nn-battle-report__section-head">CASUALTIES &amp; RESULTS</div>
            <div className="nn-battle-report__results">
              {report.results.map((r, i) => (
                <div key={i} className={`nn-battle-report__result ${resultClass(r)}`}>
                  <span>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="nn-battle-report__toggle"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        {expanded ? '▲ COLLAPSE REPORT' : '▼ EXPAND FULL REPORT'}
      </button>
    </div>
  );
}

export default BattleReportCard;
