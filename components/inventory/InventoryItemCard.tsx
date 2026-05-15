'use client';

import { motion } from 'framer-motion';
import type { InventoryItemPayload } from '@/types/api-responses';

interface InventoryItemCardProps {
  item: InventoryItemPayload;
  onClick: () => void;
}

const RARITY_TEXT: Record<string, string> = {
  Common: 'text-white/50',
  Uncommon: 'text-[--synth]',
  Rare: 'text-[--electric]',
  Epic: 'text-[--neon-pink]',
  Legendary: 'text-[--neon-yellow]',
};

const RARITY_BORDER: Record<string, string> = {
  Common: 'border-white/[0.08]',
  Uncommon: 'border-[--synth]/25',
  Rare: 'border-[--electric]/25',
  Epic: 'border-[--neon-pink]/25',
  Legendary: 'border-[--neon-yellow]/25',
};

const RARITY_GLOW: Record<string, string> = {
  Common: '',
  Uncommon: 'hover:shadow-[0_0_8px_rgba(0,200,83,0.15)]',
  Rare: 'hover:shadow-[0_0_8px_rgba(0,127,255,0.15)]',
  Epic: 'hover:shadow-[0_0_8px_rgba(255,20,147,0.15)]',
  Legendary: 'hover:shadow-[0_0_12px_rgba(200,214,0,0.25)]',
};

const TYPE_ICON: Record<string, string> = {
  METAL_DIGGER: '⚙',
  ENERGY_DIGGER: '⚡',
  UNIVERSAL_DIGGER: '💎',
  TRADEABLE_ITEM: '🎒',
};

const RARITY_ORDER: Record<string, number> = { Legendary: 0, Epic: 1, Rare: 2, Uncommon: 3, Common: 4 };

export function InventoryItemCard({ item, onClick }: InventoryItemCardProps) {
  const textColor = RARITY_TEXT[item.rarity] || 'text-white/50';
  const borderColor = RARITY_BORDER[item.rarity] || 'border-white/[0.08]';
  const glowClass = RARITY_GLOW[item.rarity] || '';
  const icon = TYPE_ICON[item.type] || '📦';

  return (
    <motion.button
      onClick={onClick}
      className={`relative w-full text-left bg-[--shadow] border ${borderColor} rounded-lg p-2.5 transition-all duration-200 cursor-pointer hover:bg-white/[0.03] ${glowClass}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Rarity indicator dot */}
      <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
        item.rarity === 'Legendary' ? 'bg-[--neon-yellow]' :
        item.rarity === 'Epic' ? 'bg-[--neon-pink]' :
        item.rarity === 'Rare' ? 'bg-[--electric]' :
        item.rarity === 'Uncommon' ? 'bg-[--synth]' :
        'bg-white/20'
      }`} />

      {/* Icon + Name */}
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-base leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`text-xs font-semibold truncate ${textColor}`}>{item.name}</h4>
        </div>
      </div>

      {/* Rarity + Type */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[9px] font-medium uppercase tracking-wider ${textColor}`}>
          {item.rarity}
        </span>
        {item.quantity > 1 && (
          <span className="text-[9px] text-[--text-3] font-mono">×{item.quantity}</span>
        )}
      </div>

      {/* Gathering Bonus (for diggers) */}
      {item.gatheringBonus > 0 && (
        <div className="text-[10px] text-[--synth] font-mono">
          +{item.gatheringBonus.toFixed(1)}% {item.bonusType === 'universal' ? 'Metal & Energy' : item.bonusType}
        </div>
      )}
    </motion.button>
  );
}
