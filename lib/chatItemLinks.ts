/**
 * FID-20260919-008: chat item-link parsing — pure module.
 *
 * History: bracket-link parsing existed only in the archived ChatMessage corpse;
 * the live renderer (ChatPanel) never rendered item links. This module carries
 * the parse/resolve semantics so the risky logic (regex bounds, validity,
 * ambiguity) is pinned directly and the component stays thin.
 *
 * Design: links render in ALL channels — only catalog-valid names become
 * clickable, so inventing [junk] can never produce a fake link; the corpse's
 * TRADE-only restriction was arbitrary and dropped.
 */
import { resolveCatalogEntry, type CatalogEntry } from '@/lib/catalogService';

/** Bounded: no nesting, no newlines, ≤64 chars inside the brackets. */
export const ITEM_LINK_REGEX = /\[([^\[\]\n]{1,64})\]/g;

/** One rendered piece of a message's content. */
export type ItemLinkSegment =
  | { type: 'text'; value: string }
  | { type: 'itemLink'; name: string; entry: CatalogEntry }
  | { type: 'invalidItem'; value: string };

/**
 * Bracketed names worth verifying against live listings (D1b): anything the
 * static catalog does not already resolve. The caller fetches/caches these.
 */
export function parseItemLinkCandidates(content: string): string[] {
  if (!content) return [];
  const out: string[] = [];
  ITEM_LINK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITEM_LINK_REGEX.exec(content)) !== null) {
    const raw = match[1].trim();
    if (raw && !resolveCatalogEntry(raw)) out.push(raw);
  }
  return out;
}

/**
 * Split message content into segments: plain text, item links (static catalog
 * OR names verified against live listings — D1b), and literal-text brackets
 * that failed both.
 */
export function parseItemLinkSegments(
  content: string,
  verifiedNames?: ReadonlySet<string>
): ItemLinkSegment[] {
  if (!content) return [];
  const segments: ItemLinkSegment[] = [];
  let lastIndex = 0;
  ITEM_LINK_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ITEM_LINK_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    const raw = match[1];
    const entry = resolveCatalogEntry(raw);
    if (entry) {
      segments.push({ type: 'itemLink', name: entry.name, entry });
    } else if (verifiedNames?.has(raw)) {
      segments.push({
        type: 'itemLink',
        name: raw,
        entry: { name: raw, kind: 'verified-listing' },
      });
    } else {
      segments.push({ type: 'invalidItem', value: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}

/**
 * The deep-link URL an item link navigates to. The game page hosts the auction
 * house as a modal, so the target is a query param, not a route.
 */
export function itemLinkHref(canonicalName: string): string {
  return `/game?market=${encodeURIComponent(canonicalName)}`;
}

/**
 * What category tab the auction panel should open for a catalog entry.
 */
export function catalogTabFor(entry: CatalogEntry): 'units' | 'resources' | 'all' {
  if (entry.kind === 'unit') return 'units';
  if (entry.kind === 'resource') return 'resources';
  return 'all';
}

/**
 * D1b deep-link target for a verified (live-listing) name: the game page hosts
 * the modal and validates the param against live listings, not the catalog.
 */
export function verifiedItemLinkHref(name: string): string {
  return `/game?market=${encodeURIComponent(name)}`;
}
