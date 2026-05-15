'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { InventoryItemPayload } from '@/types/api-responses';
import { X, MapPin, Clock } from 'lucide-react';

interface ItemDetailModalProps {
  item: InventoryItemPayload;
  onClose: () => void;
}

const RARITY_TEXT: Record<string, string> = {
  Common: 'text-white/50',
  Uncommon: 'text-[--synth]',
  Rare: 'text-[--electric]',
  Epic: 'text-[--neon-pink]',
  Legendary: 'text-[--neon-yellow]',
};

const TYPE_LABEL: Record<string, string> = {
  METAL_DIGGER: 'Metal Digger',
  ENERGY_DIGGER: 'Energy Digger',
  UNIVERSAL_DIGGER: 'Universal Digger',
  TRADEABLE_ITEM: 'Tradeable Item',
};

export function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm bg-[--shadow] border border-[--border] rounded-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[--border] bg-gradient-to-r from-white/[0.02] to-transparent">
            <h2 className={`text-sm font-bold ${RARITY_TEXT[item.rarity] || 'text-white/50'}`}>
              {item.name}
            </h2>
            <button onClick={onClose} className="text-[--text-3] hover:text-[--text-1] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Rarity + Type */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${RARITY_TEXT[item.rarity]}`}>
                {item.rarity}
              </span>
              <span className="text-[10px] text-[--text-3]">•</span>
              <span className="text-[10px] text-[--text-2]">{TYPE_LABEL[item.type] || item.type}</span>
            </div>

            {/* Gathering Bonus */}
            {item.gatheringBonus > 0 && (
              <div className="bg-[--card] border border-[--border] rounded-lg p-3">
                <h3 className="text-[10px] text-[--text-3] uppercase tracking-wider mb-2">Gathering Bonus</h3>
                <div className="space-y-1">
                  {(item.bonusType === 'metal' || item.bonusType === 'universal') && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[--text-2]">⚙ Metal</span>
                      <span className="text-xs text-[--synth] font-mono font-bold">+{item.gatheringBonus.toFixed(1)}%</span>
                    </div>
                  )}
                  {(item.bonusType === 'energy' || item.bonusType === 'universal') && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[--text-2]">⚡ Energy</span>
                      <span className="text-xs text-[--electric] font-mono font-bold">
                        +{item.bonusType === 'universal' ? item.gatheringBonus.toFixed(1) : item.gatheringBonus.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {item.description && (
              <p className="text-xs text-[--text-2] leading-relaxed">{item.description}</p>
            )}

            {/* Found info */}
            <div className="flex items-center gap-3 text-[10px] text-[--text-3]">
              {item.foundAt && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>({item.foundAt.x}, {item.foundAt.y})</span>
                </div>
              )}
              {item.foundDate && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(item.foundDate).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[--border] flex justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white/[0.04] border border-[--border] rounded-md text-xs text-[--text-2] hover:bg-white/[0.08] transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
