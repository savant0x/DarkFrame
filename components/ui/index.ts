/**
 * UI Component Library — barrel
 *
 * FID-20260908-013 (dead-kit retirement): the styling slabs (Button, Card,
 * Panel, Badge, Input, Divider, IconButton, StatCard, ProgressBar, Alert,
 * Skeleton) are deleted; their replacements are the token primitives defined
 * in app/neon-noir.css (.nn-btn, .nn-panel, .nn-chip, .nn-input, ...).
 *
 * Retained here: only components with live logic that token CSS can't replace.
 */

export { confirmDialog, ConfirmDialogHost } from './ConfirmDialog';
export type { ConfirmOptions } from './ConfirmDialog';
export { RichTextEditor } from './RichTextEditor';

// ============================================================
// USAGE:
// ============================================================
// import { confirmDialog, RichTextEditor } from '@/components/ui';
// Styling uses the .nn-* token primitives from app/neon-noir.css directly.
// ============================================================
// END OF FILE
// ============================================================
