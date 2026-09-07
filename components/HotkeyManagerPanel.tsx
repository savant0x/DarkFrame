
// ============================================================
// FILE: components/HotkeyManagerPanel.tsx
// CREATED: 2025-01-23
// ============================================================
// OVERVIEW:
// Admin panel component for managing global hotkey configuration.
// Allows viewing, editing, and resetting hotkey mappings.
// Organized by category with conflict detection and validation.
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Keyboard, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { HotkeyConfig, HotkeyCategory } from '@/types/hotkey.types';
import { findHotkeyConflicts } from '@/lib/hotkeyRegistry';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface HotkeyManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HotkeyManagerPanel({ isOpen, onClose }: HotkeyManagerPanelProps) {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  // Fetch hotkeys on mount
  useEffect(() => {
    if (isOpen) {
      fetchHotkeys();
    }
  }, [isOpen]);

  const detectConflicts = useCallback(() => {
    // Shared registry: duplicates AND bare movement-key binds (qweasdzxc) are
    // both violations of the single-mapping invariant.
    const conflicts = findHotkeyConflicts(hotkeys);
    setConflicts(conflicts.flatMap((c) => c.actions));
  }, [hotkeys]);

  // Check for conflicts whenever hotkeys change
  useEffect(() => {
    detectConflicts();
  }, [detectConflicts]);

  const fetchHotkeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/hotkeys');
      const data = await response.json();

      if (data.success) {
        setHotkeys(data.hotkeys);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to load hotkeys' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error loading hotkeys' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (conflicts.length > 0) {
      setMessage({ type: 'error', text: 'Cannot save: resolve hotkey conflicts first' });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/hotkeys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotkeys }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Hotkey settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save hotkeys' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error saving hotkeys' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!(await confirmDialog('Reset all hotkeys to default configuration? This cannot be undone.'))) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/hotkeys', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setHotkeys(data.hotkeys);
        setMessage({ type: 'success', text: 'Hotkeys reset to defaults!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to reset hotkeys' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error resetting hotkeys' });
    } finally {
      setSaving(false);
    }
  };

  const updateHotkeyKey = (action: string, newKey: string) => {
    setHotkeys((prev) =>
      prev.map((hk) =>
        hk.action === action ? { ...hk, key: newKey.toLowerCase() } : hk
      )
    );
    setEditingKey(null);
  };

  const groupedHotkeys = hotkeys.reduce((acc, hk) => {
    if (!acc[hk.category]) {
      acc[hk.category] = [];
    }
    acc[hk.category].push(hk);
    return acc;
  }, {} as Record<HotkeyCategory, HotkeyConfig[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-cyan)] border-b border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[color:var(--nn-text-primary)] flex items-center gap-2">
            <Keyboard className="w-6 h-6" />
            Hotkey Configuration Manager
          </h2>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-primary)]/70 hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`px-6 py-3 flex items-center gap-2 border-b ${
              message.type === 'success'
                ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] text-[color:var(--nn-green)]'
                : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] text-[color:var(--nn-magenta)]'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center text-[color:var(--nn-text-primary)]/70 py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] border-t-transparent"></div>
              <p className="mt-4">Loading hotkey configuration...</p>
            </div>
          ) : (
            Object.entries(groupedHotkeys).map(([category, categoryHotkeys]) => (
              <div key={category} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
                <h3 className="text-lg font-semibold text-[color:var(--nn-cyan)] mb-4">{category}</h3>
                <div className="space-y-2">
                  {categoryHotkeys.map((hk) => (
                    <div
                      key={hk.action}
                      className={`flex items-center gap-4 p-3 rounded-none ${
                        conflicts.includes(hk.action)
                          ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'
                          : 'bg-[color:var(--nn-void)]'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-[color:var(--nn-text-primary)]">{hk.displayName}</div>
                        <div className="text-xs text-[color:var(--nn-text-primary)]/60">{hk.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingKey === hk.action ? (
                          <input
                            type="text"
                            maxLength={1}
                            autoFocus
                            className="w-16 px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none text-center text-[color:var(--nn-text-primary)] font-mono uppercase"
                            defaultValue={hk.key}
                            onBlur={(e) => updateHotkeyKey(hk.action, e.target.value || hk.key)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateHotkeyKey(hk.action, e.currentTarget.value || hk.key);
                              } else if (e.key === 'Escape') {
                                setEditingKey(null);
                              }
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingKey(hk.action)}
                            className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none text-[color:var(--nn-text-primary)] font-mono uppercase transition-colors"
                          >
                            {hk.requiresShift && 'Shift+'}
                            {hk.requiresCtrl && 'Ctrl+'}
                            {hk.requiresAlt && 'Alt+'}
                            {hk.key}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] px-6 py-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={saving || loading}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none text-[color:var(--nn-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <div className="flex items-center gap-3">
            {conflicts.length > 0 && (
              <span className="text-[color:var(--nn-magenta)] text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || conflicts.length > 0}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none text-[color:var(--nn-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Fetches current hotkey configuration from /api/admin/hotkeys
// - Groups hotkeys by category for organized display
// - Inline editing of hotkey values with click-to-edit
// - Automatic conflict detection (same key combination)
// - Visual indicators for conflicts (red border)
// - Prevents saving if conflicts exist
// - Reset to defaults with confirmation dialog
// - Loading and saving states with spinners
// - Success/error messages with auto-dismiss
// - Responsive layout with scroll for long lists
// - Admin-only access enforced by API endpoint
// ============================================================
// END OF FILE
// ============================================================
