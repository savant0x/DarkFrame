/**
 * @file components/clan/CreateClanModal.tsx
 * @created 2025-10-19
 * @overview Modal for creating a new clan with validation and cost display
 * 
 * OVERVIEW:
 * Full-featured clan creation interface with:
 * - Clan name validation (3-30 characters, uniqueness check)
 * - Description field (max 500 characters)
 * - Privacy toggle (public/private)
 * - Entry requirements (minimum level, minimum power)
 * - Real-time cost display (50K Metal + 50K Energy + 100 RP)
 * - Form validation and error handling
 * - Success callback integration
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 1.2 - Clan Creation & Join Modals
 * - Uses DarkFrame design system
 * - API integration: POST /api/clan/create
 * - Toast notifications for feedback
 */

'use client';

import React, { useState } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';
import { useGameContext } from '@/context/GameContext';

import { 
  X, 
  Crown, 


  Coins,


  AlertCircle,
  Check
} from 'lucide-react';
import { toast } from 'sonner';


interface CreateClanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Clan creation costs (FID-20260909-028 §2.3: aligned with the binding contract —
// CLAN_CONSTANTS.CREATION_COST in types/clan.types.ts, the same values
// lib/clanService.createClan validates and deducts. The old 50k/50k/100RP
// constants lied about the price and gated submission on phantom RP.)
const CREATION_COSTS = {
  metal: 1500000,
  energy: 1500000,
};

export default function CreateClanModal({ isOpen, onClose, onSuccess }: CreateClanModalProps) {
  const { player, refreshPlayer } = useGameContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  // Form state (FID-20260909-028 §2.3: `tag` is REQUIRED by CreateClanSchema —
  // the old form never sent one, so every submit died in validation. The
  // phantom isPublic/minLevel/minPower fields are gone: the schema strips them,
  // the clans table has no such columns, and join policy is a leader setting
  // per docs/COMPLETE_CLAN_SYSTEM_PLAN.md's settings model.)
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: '',
  });

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Validates clan name length and format (mirrors CreateClanSchema)
   */
  const validateName = (name: string): string | null => {
    if (name.length < 3) return 'Name must be at least 3 characters';
    if (name.length > 30) return 'Name must be at most 30 characters';
    if (!/^[a-zA-Z0-9 _-]+$/.test(name)) return 'Name can only contain letters, numbers, spaces, hyphens, and underscores';
    return null;
  };

  /**
   * Validates clan tag format (mirrors CreateClanSchema: 2-5, uppercase alnum —
   * service enforces uniqueness and 2-6 length)
   */
  const validateTag = (tag: string): string | null => {
    if (tag.length < 2) return 'Tag must be at least 2 characters';
    if (tag.length > 5) return 'Tag must be at most 5 characters';
    if (!/^[A-Z0-9]+$/.test(tag)) return 'Tag can only contain uppercase letters and numbers';
    return null;
  };

  /**
   * Checks if clan name is available via API
   */
  const checkNameAvailability = async (name: string) => {
    const validationError = validateName(name);
    if (validationError) {
      setNameAvailable(null);
      return;
    }

    setIsCheckingName(true);
    try {
      const response = await fetch(`/api/clan/check-name?name=${encodeURIComponent(name)}`);
      const data = await response.json();
      setNameAvailable(data.available);
    } catch (error) {
      console.error('Error checking name:', error);
      setNameAvailable(null);
    } finally {
      setIsCheckingName(false);
    }
  };

  /**
   * Handles form field changes (keyed union: value type must match the field)
   */
  const handleChange = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Check name availability on name change
    if (field === 'name' && typeof value === 'string' && value) {
      checkNameAvailability(value);
    }
  };

  /**
   * Tag input handler: auto-uppercases (schema requires [A-Z0-9]+) and clears
   * the field error as the user types.
   */
  const handleTagChange = (raw: string) => {
    const value = raw.toUpperCase().slice(0, 5);
    setFormData(prev => ({ ...prev, tag: value }));
    if (errors.tag) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.tag;
        return newErrors;
      });
    }
  };

  /**
   * Validates entire form before submission
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;
    if (nameAvailable === false) newErrors.name = 'This clan name is already taken';

    // Tag validation (required by the schema — the old form never sent it)
    const tagError = validateTag(formData.tag);
    if (tagError) newErrors.tag = tagError;

    // Description validation
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be at most 500 characters';
    }

    // Resource validation
    if (!player) {
      newErrors.submit = 'Player data not loaded';
      setErrors(newErrors);
      return false;
    }

    if (player.resources.metal < CREATION_COSTS.metal) {
      newErrors.submit = `Insufficient metal (need ${CREATION_COSTS.metal.toLocaleString()})`;
    }
    if (player.resources.energy < CREATION_COSTS.energy) {
      newErrors.submit = `Insufficient energy (need ${CREATION_COSTS.energy.toLocaleString()})`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/clan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Schema contract: { name, tag, description? } — the session is the
        // creator; extra fields are stripped by zod and were never stored.
        body: JSON.stringify({
          name: formData.name.trim(),
          tag: formData.tag.trim(),
          description: formData.description.trim(),
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create clan');
      }

      toast.success('Clan created successfully!');
      await refreshPlayer();
      onSuccess();
    } catch (error) {
      console.error('Error creating clan:', error);
      toast.error(getErrorMessage(error) || 'Failed to create clan');
      setErrors({ submit: getErrorMessage(error) || 'Failed to create clan' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Checks if player can afford clan creation
   */
  const canAfford = player && 
    player.resources.metal >= CREATION_COSTS.metal &&
    player.resources.energy >= CREATION_COSTS.energy;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — FID-013: framer motion.div → plain node with gated nn-fade */}
      <div
        className="nn-fade absolute inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — FID-013: framer motion.div → plain node with gated nn-fade; gradient slab → token void */}
      <div
        className="nn-fade relative w-full max-w-2xl bg-[color:var(--nn-void)] rounded-none border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] shadow-2xl overflow-hidden"
      >
        {/* Header — gradient strip → quiet accent tint */}
        <div className="bg-[color-mix(in_oklab,var(--nn-violet)_12%,transparent)] border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-[color:var(--nn-amber)]" />
              <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">Create New Clan</h2>
            </div>
            <button
              onClick={onClose}
              className="nn-text-secondary hover:text-[color:var(--nn-text-primary)] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {/* Cost Display */}
            <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
              <h3 className="text-sm font-semibold text-[color:var(--nn-text-primary)] mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-[color:var(--nn-amber)]" />
                Creation Cost
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-xs nn-text-secondary mb-1">Metal</div>
                  <div className={`text-lg font-bold ${player && player.resources.metal >= CREATION_COSTS.metal ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                    {CREATION_COSTS.metal.toLocaleString()}
                  </div>
                  {player && (
                    <div className="text-xs nn-text-secondary">
                      Have: {player.resources.metal.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs nn-text-secondary mb-1">Energy</div>
                  <div className={`text-lg font-bold ${player && player.resources.energy >= CREATION_COSTS.energy ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                    {CREATION_COSTS.energy.toLocaleString()}
                  </div>
                  {player && (
                    <div className="text-xs nn-text-secondary">
                      Have: {player.resources.energy.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clan Name */}
            <div>
              <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">
                Clan Name <span className="text-[color:var(--nn-magenta)]">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter clan name (3-30 characters)"
                  className="nn-input w-full"
                  maxLength={30}
                 />
                {formData.name.length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingName ? (
                      <div className="w-5 h-5 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] border-t-transparent rounded-none" />
                    ) : nameAvailable === true ? (
                      <Check className="w-5 h-5 text-[color:var(--nn-green)]" />
                    ) : nameAvailable === false ? (
                      <X className="w-5 h-5 text-[color:var(--nn-magenta)]" />
                    ) : null}
                  </div>
                )}
              </div>
              {errors.name && (
                <p className="text-[color:var(--nn-magenta)] text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
              <p className="nn-text-secondary text-xs mt-1">
                {formData.name.length}/30 characters
              </p>
            </div>

            {/* Clan Tag (FID-20260909-028 §2.3: REQUIRED by the API schema — the
                old form omitted it entirely, so every creation attempt failed
                validation with "Invalid input" and the flow read as broken.) */}
            <div>
              <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">
                Clan Tag <span className="text-[color:var(--nn-magenta)]">*</span>
              </label>
              <input
                type="text"
                value={formData.tag}
                onChange={(e) => handleTagChange(e.target.value)}
                placeholder="e.g. DW (2-5 uppercase letters/numbers)"
                className="nn-input w-full font-mono tracking-widest"
                maxLength={5}
              />
              {errors.tag && (
                <p className="text-[color:var(--nn-magenta)] text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.tag}
                </p>
              )}
              <p className="nn-text-secondary text-xs mt-1">
                Shown next to your clan name everywhere. 2-5 uppercase letters/numbers.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-[color:var(--nn-text-primary)] mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe your clan's purpose and goals..."
                className="w-full px-4 py-2 nn-surface border border-[color:var(--nn-glass-border)] rounded-none text-[color:var(--nn-text-primary)] placeholder-text-secondary focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                rows={4}
                maxLength={500}
              />
              {errors.description && (
                <p className="text-[color:var(--nn-magenta)] text-xs mt-1">{errors.description}</p>
              )}
              <p className="nn-text-secondary text-xs mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>            {/* Privacy & Requirements — dropped (FID-20260909-028 §2.3): the clans
                table has no public/private or min-power columns; join policy is a
                leader setting (requiresApproval / minLevelToJoin defaults are set
                by the service). The old controls shaped a payload the API strips. */}

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[color:var(--nn-magenta)] flex-shrink-0 mt-0.5" />
                <p className="text-[color:var(--nn-magenta)] text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="nn-btn"
                type="button"
                onClick={onClose} disabled={isSubmitting}
              >
                Cancel
              </button>
              <button className="nn-btn nn-btn--primary"
                type="submit" disabled={isSubmitting || !canAfford || nameAvailable === false || formData.name.length < 3 || formData.tag.length < 2} >
                {isSubmitting ? 'Creating...' : 'Create Clan'}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}
