/**
 * System Reset Modal - Admin Panel
 * Created: 2025-01-18
 * 
 * OVERVIEW:
 * ⚠️ DANGEROUS OPERATIONS ⚠️
 * 
 * Provides admin tools for performing irreversible system-wide operations.
 * All actions require multiple confirmations and type-to-confirm verification
 * to prevent accidental data loss. All operations are logged to adminLogs
 * collection for audit trail.
 * 
 * Available Operations:
 * - Clear Battle Logs: Delete all combat history
 * - Clear Activity Logs: Delete all player activity records
 * - Reset Anti-Cheat Flags: Clear all flags (not bans)
 * - Clear All Sessions: Reset all player session data
 * 
 * Safety Features:
 * - Type-to-confirm (must type exact action name)
 * - Secondary confirmation dialog
 * - Admin action logging
 * - No accidental clicks (disabled state until typed correctly)
 * - Red warning styling throughout
 * 
 * NOT INCLUDED (too dangerous without backup):
 * - Player progress reset
 * - Map regeneration
 * - Tech tree reset
 * These should be implemented only with database backup verification.
 */

'use client';

import React, { useState } from 'react';

/**
 * Component props
 */
interface SystemResetModalProps {
  onClose: () => void;
}

/**
 * Confirmation state
 */
interface ConfirmState {
  action: string | null;
  typedConfirm: string;
  showSecondary: boolean;
}

/**
 * System Reset Modal Component
 * 
 * Provides dangerous admin operations with extensive safety checks.
 */
export default function SystemResetModal({ onClose }: SystemResetModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({
    action: null,
    typedConfirm: '',
    showSecondary: false,
  });

  /**
   * Available reset actions
   */
  const resetActions = [
    {
      id: 'clear-battle-logs',
      name: 'Clear Battle Logs',
      confirmText: 'DELETE BATTLE LOGS',
      description: 'Permanently delete all battle history. This cannot be undone.',
      icon: '⚔️',
      color: 'red',
    },
    {
      id: 'clear-activity-logs',
      name: 'Clear Activity Logs',
      confirmText: 'DELETE ACTIVITY LOGS',
      description: 'Permanently delete all player activity records. This cannot be undone.',
      icon: '📋',
      color: 'orange',
    },
    {
      id: 'reset-flags',
      name: 'Reset All Flags',
      confirmText: 'RESET ALL FLAGS',
      description: 'Clear all anti-cheat flags (does not remove bans). Use for fresh start after fixing issues.',
      icon: '🚩',
      color: 'yellow',
    },
    {
      id: 'clear-sessions',
      name: 'Clear All Sessions',
      confirmText: 'DELETE ALL SESSIONS',
      description: 'Delete all player session data. Players will need to create new sessions on next login.',
      icon: '🕒',
      color: 'purple',
    },
  ];

  /**
   * Start confirmation process
   */
  const handleStartConfirm = (actionId: string) => {
    setConfirm({
      action: actionId,
      typedConfirm: '',
      showSecondary: false,
    });
    setError(null);
    setSuccess(null);
  };

  /**
   * Cancel confirmation
   */
  const handleCancelConfirm = () => {
    setConfirm({
      action: null,
      typedConfirm: '',
      showSecondary: false,
    });
  };

  /**
   * Proceed to secondary confirmation
   */
  const handleProceedToSecondary = () => {
    const action = resetActions.find(a => a.id === confirm.action);
    if (action && confirm.typedConfirm === action.confirmText) {
      setConfirm({ ...confirm, showSecondary: true });
    }
  };

  /**
   * Execute the reset action
   */
  const handleExecute = async () => {
    if (!confirm.action) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/system-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirm.action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      setSuccess(data.message || 'Reset completed successfully');
      handleCancelConfirm();
    } catch (err) {
      console.error('[SystemReset] Failed:', err);
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get current action
   */
  const currentAction = confirm.action
    ? resetActions.find(a => a.id === confirm.action)
    : null;

  /**
   * Check if confirm text matches
   */
  const isConfirmValid = currentAction && confirm.typedConfirm === currentAction.confirmText;

  /**
   * Render main modal
   */
  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-magenta)]">⚠️ System Reset Tools</h2>
            <p className="text-[color:var(--nn-magenta)] text-sm mt-1 font-bold">
              DANGEROUS OPERATIONS - REQUIRES CONFIRMATION
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-b border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]">
            <p className="text-[color:var(--nn-green)] font-medium">✅ {success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-b border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]">
            <p className="text-[color:var(--nn-magenta)] font-medium">❌ {error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!confirm.action ? (
            /* Action Selection */
            <div>
              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 mb-6">
                <h3 className="text-[color:var(--nn-magenta)] font-bold mb-2">⚠️ WARNING</h3>
                <p className="text-[color:var(--nn-text-secondary)] text-sm">
                  These operations are IRREVERSIBLE and can cause significant data loss.
                  Only use these tools if you understand the consequences.
                  All actions are logged to the admin audit trail.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resetActions.map((action) => (
                  <div
                    key={action.id}
                    className={`border-2 border-${action.color}-700 bg-${action.color}-900/20 rounded-none p-4`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">{action.icon}</span>
                      <div className="flex-1">
                        <h3 className={`text-${action.color}-400 font-bold text-lg`}>
                          {action.name}
                        </h3>
                        <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartConfirm(action.id)}
                      className={`w-full px-4 py-2 bg-${action.color}-700 hover:bg-${action.color}-600 text-[color:var(--nn-text-primary)] rounded-none font-medium transition`}
                    >
                      Initiate {action.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : !confirm.showSecondary ? (
            /* Primary Confirmation */
            <div>
              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-6 mb-6">
                <h3 className="text-[color:var(--nn-magenta)] font-bold text-xl mb-4">
                  {currentAction?.icon} Confirm {currentAction?.name}
                </h3>
                <p className="text-[color:var(--nn-text-secondary)] mb-4">{currentAction?.description}</p>
                
                <div className="bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 mb-4">
                  <p className="text-[color:var(--nn-magenta)] font-bold mb-2">To proceed, type exactly:</p>
                  <p className="text-[color:var(--nn-text-primary)] font-mono text-lg bg-[color:var(--nn-void)] px-3 py-2 rounded-none">
                    {currentAction?.confirmText}
                  </p>
                </div>

                <input
                  type="text"
                  value={confirm.typedConfirm}
                  onChange={(e) => setConfirm({ ...confirm, typedConfirm: e.target.value })}
                  placeholder="Type confirmation text here..."
                  className="w-full px-4 py-3 bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none text-[color:var(--nn-text-primary)] font-mono text-lg focus:border-red-500 outline-none"
                />

                {confirm.typedConfirm && !isConfirmValid && (
                  <p className="text-[color:var(--nn-magenta)] text-sm mt-2">
                    ❌ Text does not match. Check spelling and capitalization.
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelConfirm}
                  className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedToSecondary}
                  disabled={!isConfirmValid}
                  className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] rounded-none font-medium transition"
                >
                  Proceed to Final Confirmation
                </button>
              </div>
            </div>
          ) : (
            /* Secondary Confirmation */
            <div>
              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-6 mb-6">
                <h3 className="text-[color:var(--nn-magenta)] font-bold text-xl mb-4">
                  ⚠️ FINAL CONFIRMATION
                </h3>
                <p className="text-[color:var(--nn-text-primary)] text-lg mb-4">
                  You are about to execute: <span className="font-bold">{currentAction?.name}</span>
                </p>
                <p className="text-[color:var(--nn-magenta)] font-bold">
                  This action is IRREVERSIBLE. All data will be permanently deleted.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelConfirm}
                  className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecute}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-bold transition"
                >
                  {loading ? 'Executing...' : 'EXECUTE RESET'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Safety Mechanisms:
 * - Type-to-confirm: User must type exact confirmation text
 * - Secondary confirmation: Additional "are you sure?" dialog
 * - Disabled buttons: Cannot proceed until conditions met
 * - Clear warnings: Red styling and explicit danger messaging
 * - Admin logging: All operations logged to audit trail
 * 
 * Available Operations:
 * 1. Clear Battle Logs: Deletes all battleLogs documents
 * 2. Clear Activity Logs: Deletes all playerActivity documents
 * 3. Reset All Flags: Deletes all playerFlags documents (not bans)
 * 4. Clear All Sessions: Deletes all playerSessions documents
 * 
 * Operations NOT Included (require backup verification):
 * - Reset Player Progress: Too destructive without backup
 * - Regenerate Map: Would break all player positions
 * - Reset Tech Tree: Affects all player progression
 * 
 * Future Enhancements:
 * - Database backup verification before dangerous operations
 * - Rollback capability with transaction support
 * - Scheduled resets with email notifications
 * - Partial resets (by date range, specific players)
 * - Export data before deletion option
 * 
 * Dependencies:
 * - /api/admin/system-reset endpoint (POST with action parameter)
 * - Admin authentication in parent component
 * - adminLogs collection for audit trail
 */
