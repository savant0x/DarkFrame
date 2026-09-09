/**
 * @file components/ui/ConfirmDialog.tsx
 * @created 2026-09-06
 * @overview Promise-based global confirm dialog (FID-20260906-005 T2.1 / R3).
 *
 * Replaces window.confirm()/window.alert() — which block the main thread and
 * cannot be styled — with an in-theme modal that any client component can
 * await from anywhere:
 *
 *   if (!(await confirmDialog('Delete this schedule?'))) return;
 *   await confirmDialog({ title: 'Ban player', message: `Ban ${username}?`, danger: true });
 *   await confirmDialog({ message: analyticsText, confirmLabel: 'OK', hideCancel: true }); // info modal
 *
 * Mount <ConfirmDialogHost /> ONCE in the root layout (next to <ToastContainer />).
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export interface ConfirmOptions {
  /** Heading above the message (defaults to 'Please confirm'). */
  title?: string;
  /** Body text. Templates/multi-line strings render verbatim (pre-formatted). */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive confirmations. */
  danger?: boolean;
  /** Info-modal mode: single OK button, no cancel. */
  hideCancel?: boolean;
}

type Listener = (options: ConfirmOptions) => Promise<boolean>;

let listener: Listener | null = null;

/** Ask the user to confirm. Resolves true (confirmed) / false (cancelled). */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  if (!listener) {
    // Host not mounted (shouldn't happen — it lives in the root layout). Fail
    // CLOSED: refusing the action is always the safe default.
    return Promise.resolve(false);
  }
  return listener(opts);
}

/**
 * The single mounted host. Registers itself as the confirm target and renders
 * the overlay while a request is pending. Escape / backdrop click cancel;
 * Enter confirms.
 */
export function ConfirmDialogHost(): React.JSX.Element | null {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  useEffect(() => {
    listener = (opts) =>
      new Promise<boolean>((resolve) => {
        setOptions(opts);
        setResolver(() => resolve);
      });
    return () => {
      listener = null;
    };
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      if (resolver) resolver(value);
      setResolver(null);
      setOptions(null);
    },
    [resolver],
  );

  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, settle]);

  if (!options) return null;

  const btnBg = options.danger
    ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] hover:bg-[color-mix(in_oklab,var(--nn-magenta)_32%,transparent)]'
    : 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] hover:bg-[color-mix(in_oklab,var(--nn-cyan)_32%,transparent)]';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] backdrop-blur-sm p-4"
      role="presentation"
      onClick={() => settle(false)}
    >
      <div
        className="w-full max-w-md rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_20%,transparent)] bg-[color:var(--nn-glass-dark)] shadow-[0_0_24px_color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] p-5 space-y-4"
        role="alertdialog"
        aria-modal="true"
        aria-label={options.title || 'Confirm'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {options.danger ? (
            <AlertTriangle className="w-5 h-5 text-[color:var(--nn-magenta)] mt-0.5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <Info className="w-5 h-5 text-[color:var(--nn-cyan)] mt-0.5 flex-shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            {options.title && (
              <h2 className={`text-sm font-bold mb-1 ${options.danger ? 'text-[color:var(--nn-magenta)]' : 'text-[color:var(--nn-cyan)]'}`}>
                {options.title}
              </h2>
            )}
            <p className="text-sm text-[color:var(--nn-text-primary)] whitespace-pre-wrap break-words">{options.message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {!options.hideCancel && (
            <button
              type="button"
              onClick={() => settle(false)}
              className="px-4 py-2 rounded-none text-sm font-medium text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] border border-[color-mix(in_oklab,var(--nn-cyan)_20%,transparent)] hover:border-[color-mix(in_oklab,var(--nn-cyan)_35%,transparent)] transition-colors"
            >
              {options.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => settle(true)}
            className={`px-4 py-2 rounded-none text-sm font-semibold text-[color:var(--nn-text-primary)] transition-colors ${btnBg}`}
          >
            {options.confirmLabel || (options.hideCancel ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
