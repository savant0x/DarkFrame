/**
 * @file components/BackButton.tsx
 * @created 2025-10-17
 * @overview Reusable back button component for navigation
 * 
 * OVERVIEW:
 * Standard back button that returns user to /game main page.
 * Used across all secondary pages (inventory, bank, shrine, unit factory, battle logs).
 */

'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  label?: string;
  destination?: string;
}

/**
 * BackButton component for returning to main game or custom destination
 */
export default function BackButton({ label = '← Back to Game', destination = '/game' }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(destination)}
      className="nn-btn nn-btn--ghost"
      style={{ width: 'auto' }}
    >
      {label}
    </button>
  );
}

// ============================================================
// END OF FILE
// Implementation Notes:
// - Uses Next.js router for navigation
// - Default destination is /game
// - Customizable label and destination
// - Consistent styling with rest of application
// ============================================================
