/**
 * DarkFrame UI — Shared Design System
 * Import these classes instead of writing raw Tailwind.
 * This ensures every component looks like it belongs to the same game.
 */

// ── Card Shell ──
export const CARD = 'bg-[--card] border border-[--border] rounded-lg overflow-hidden';
export const CARD_HEADER = 'px-3 py-2 border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5';
export const CARD_BODY = 'p-2.5';

// ── Card Header Gradient Accents (use with CARD_HEADER) ──
export const ACCENT_ELECTRIC = 'bg-gradient-to-r from-[--electric]/8 to-transparent';
export const ACCENT_PINK = 'bg-gradient-to-r from-[--neon-pink]/8 to-transparent';
export const ACCENT_RED = 'bg-gradient-to-r from-[--neon-red]/8 to-transparent';
export const ACCENT_SOLAR = 'bg-gradient-to-r from-[--solar]/8 to-transparent';
export const ACCENT_SYNTH = 'bg-gradient-to-r from-[--synth]/8 to-transparent';
export const ACCENT_YELLOW = 'bg-gradient-to-r from-[--neon-yellow]/8 to-transparent';
export const ACCENT_NONE = 'bg-gradient-to-r from-white/[0.03] to-transparent';

// ── Table ──
export const TABLE = 'w-full text-xs border-collapse';
export const TABLE_ROW_EVEN = 'bg-[--row-even]';
export const TABLE_ROW_ODD = 'bg-[--row-odd]';
export const TABLE_CELL = 'px-2 py-1';
export const TABLE_LABEL = 'px-2 py-1 text-[--text-2]';
export const TABLE_VALUE = 'px-2 py-1 text-right text-[--text-1] font-bold';
export const TABLE_DIM = 'px-2 py-1 text-right text-[--text-3]';

// ── Buttons ──
export const BTN = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border border-[--border] transition-all duration-150 cursor-pointer';
export const BTN_PRIMARY = 'bg-[--electric]/15 border-[--electric]/25 text-[--electric] hover:bg-[--electric]/25 hover:shadow-glow-electric';
export const BTN_DANGER = 'bg-[--neon-red]/15 border-[--neon-red]/25 text-[--neon-red] hover:bg-[--neon-red]/25 hover:shadow-glow-red';
export const BTN_SUCCESS = 'bg-[--synth-dim] border-[--synth]/20 text-[--synth] hover:bg-[--synth]/20 hover:shadow-glow-synth';
export const BTN_WARNING = 'bg-[--neon-yellow-dim] border-[--neon-yellow]/25 text-[--neon-yellow] hover:bg-[--neon-yellow]/25';
export const BTN_GHOST = 'bg-white/[0.03] border-[--border] text-[--text-1] hover:bg-white/[0.06]';
export const BTN_DISABLED = 'opacity-30 cursor-not-allowed';

// ── Status Dot ──
export const DOT_GREEN = 'w-1.5 h-1.5 rounded-full bg-[--synth] shadow-[0_0_4px_rgba(0,200,83,0.25)]';
export const DOT_YELLOW = 'w-1.5 h-1.5 rounded-full bg-[--neon-yellow] shadow-[0_0_4px_rgba(200,214,0,0.25)]';
export const DOT_RED = 'w-1.5 h-1.5 rounded-full bg-[--neon-red] shadow-[0_0_4px_rgba(247,55,24,0.25)]';
export const DOT_GRAY = 'w-1.5 h-1.5 rounded-full bg-[--text-3]';

// ── Info Row (label + value) ──
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[--text-2]">{label}</span>
      <span className="font-semibold text-[--text-1]">{value}</span>
    </div>
  );
}

// ── Section Divider ──
export const DIVIDER = 'border-t border-[--border]';

// ── Scrollbar ──
export const SCROLLBAR = 'overflow-y-auto scrollbar-thin';
