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
import { useGameContext } from '@/context/GameContext';
import { Button, Input, Badge } from '@/components/ui';
import { 
  X, 
  Crown, 
  Users, 
  Shield, 
  Coins,
  Zap,
  Beaker,
  AlertCircle,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateClanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Clan creation costs (from specification)
const CREATION_COSTS = {
  metal: 50000,
  energy: 50000,
  researchPoints: 100
};

export default function CreateClanModal({ isOpen, onClose, onSuccess }: CreateClanModalProps) {
  const { player, refreshPlayer } = useGameContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    minLevel: 1,
    minPower: 0
  });

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Validates clan name length and format
   */
  const validateName = (name: string): string | null => {
    if (name.length < 3) return 'Name must be at least 3 characters';
    if (name.length > 30) return 'Name must be at most 30 characters';
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) return 'Name can only contain letters, numbers, and spaces';
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
   * Handles form field changes
   */
  const handleChange = (field: string, value: any) => {
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
    if (field === 'name' && value) {
      checkNameAvailability(value);
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
    if (player.researchPoints < CREATION_COSTS.researchPoints) {
      newErrors.submit = `Insufficient RP (need ${CREATION_COSTS.researchPoints})`;
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
        body: JSON.stringify({
          username: player?.username,
          name: formData.name.trim(),
          description: formData.description.trim(),
          isPublic: formData.isPublic,
          minLevel: formData.minLevel,
          minPower: formData.minPower
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create clan');
      }

      toast.success('Clan created successfully!');
      await refreshPlayer();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating clan:', error);
      toast.error(error.message || 'Failed to create clan');
      setErrors({ submit: error.message || 'Failed to create clan' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Checks if player can afford clan creation
   */
  const canAfford = player && 
    player.resources.metal >= CREATION_COSTS.metal &&
    player.resources.energy >= CREATION_COSTS.energy &&
    player.researchPoints >= CREATION_COSTS.researchPoints;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-purple-500/30 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-b border-purple-500/30 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold text-white">Create New Clan</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {/* Cost Display */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                Creation Cost
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Metal</div>
                  <div className={`text-lg font-bold ${player && player.resources.metal >= CREATION_COSTS.metal ? 'text-green-400' : 'text-red-400'}`}>
                    {CREATION_COSTS.metal.toLocaleString()}
                  </div>
                  {player && (
                    <div className="text-xs text-gray-500">
                      Have: {player.resources.metal.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Energy</div>
                  <div className={`text-lg font-bold ${player && player.resources.energy >= CREATION_COSTS.energy ? 'text-green-400' : 'text-red-400'}`}>
                    {CREATION_COSTS.energy.toLocaleString()}
                  </div>
                  {player && (
                    <div className="text-xs text-gray-500">
                      Have: {player.resources.energy.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">RP</div>
                  <div className={`text-lg font-bold ${player && player.researchPoints >= CREATION_COSTS.researchPoints ? 'text-green-400' : 'text-red-400'}`}>
                    {CREATION_COSTS.researchPoints}
                  </div>
                  {player && (
                    <div className="text-xs text-gray-500">
                      Have: {player.researchPoints}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clan Name */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Clan Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter clan name (3-30 characters)"
                  className="w-full"
                  maxLength={30}
                />
                {formData.name.length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingName ? (
                      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    ) : nameAvailable === true ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : nameAvailable === false ? (
                      <X className="w-5 h-5 text-red-400" />
                    ) : null}
                  </div>
                )}
              </div>
              {errors.name && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
              <p className="text-gray-400 text-xs mt-1">
                {formData.name.length}/30 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe your clan's purpose and goals..."
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                rows={4}
                maxLength={500}
              />
              {errors.description && (
                <p className="text-red-400 text-xs mt-1">{errors.description}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>

            {/* Privacy & Requirements */}
            <div className="grid grid-cols-2 gap-4">
              {/* Privacy Toggle */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Privacy
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('isPublic', true)}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      formData.isPublic
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-slate-800 border-slate-600 text-gray-400'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('isPublic', false)}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      !formData.isPublic
                        ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                        : 'bg-slate-800 border-slate-600 text-gray-400'
                    }`}
                  >
                    Private
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {formData.isPublic ? 'Anyone can join' : 'Requires approval'}
                </p>
              </div>

              {/* Minimum Level */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Minimum Level
                </label>
                <Input
                  type="number"
                  value={formData.minLevel}
                  onChange={(e) => handleChange('minLevel', parseInt(e.target.value) || 1)}
                  min={1}
                  max={50}
                  className="w-full"
                />
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                fullWidth
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={isSubmitting || !canAfford || nameAvailable === false || formData.name.length < 3}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Clan'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
