/**
 * @file __tests__/lib/botNameGeneration.test.ts
 * @created 2026-09-06 (FID-20260906-007)
 * @overview Contract tests for bot name generation
 *
 * The invariant under test: every bot username fits `players.username`
 * varchar(20) PRIMARY KEY (lib/db/schema/players.ts) — overflow crashes the
 * insert, which is the same failure class as the flags.id bug (SCOPE #20).
 * All generators must also return themed names (no machine slugs).
 */

import { describe, it, expect } from 'vitest';
import {
  generateBotName,
  generateBeerBaseName,
  generateBossName,
} from '@/lib/botService';
import { UsernameSchema } from '@/lib/validation/schemas';

const MAX_USERNAME_LENGTH = 20;
const SAMPLES = 500;

describe('bot name generation (FID-20260906-007)', () => {
  describe('generateBotName', () => {
    it('always fits the varchar(20) username column', () => {
      const names = new Set<string>();
      for (let i = 0; i < SAMPLES; i++) {
        const name = generateBotName();
        expect(name.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
        names.add(name);
      }
      // Themed composition space must stay varied, not collapse to fallbacks.
      expect(names.size).toBeGreaterThan(SAMPLES / 4);
    });

    it('produces themed Prefix_Suffix names, never machine slugs', () => {
      for (let i = 0; i < SAMPLES; i++) {
        const name = generateBotName();
        expect(name).toMatch(/^[A-Z][a-z]+(_[A-Za-z]+)*(_\d{1,3})?$/);
        expect(name).not.toMatch(/^b[A-Z]\d{12}$/); // legacy Beer Base slug shape
      }
    });

    it('always satisfies UsernameSchema (no hyphens/spaces)', () => {
      for (let i = 0; i < SAMPLES; i++) {
        expect(UsernameSchema.safeParse(generateBotName()).success).toBe(true);
      }
    });
  });

  describe('generateBeerBaseName', () => {
    it('always fits the varchar(20) username column, including variants', () => {
      for (let i = 0; i < SAMPLES; i++) {
        const name = generateBeerBaseName();
        expect(name.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
      }
      for (let variant = 0; variant < 5; variant++) {
        for (let i = 0; i < 100; i++) {
          const name = generateBeerBaseName(variant);
          expect(name.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
        }
      }
    });

    it('produces place-style "<Descriptor>_<Noun>" names', () => {
      for (let i = 0; i < SAMPLES; i++) {
        const name = generateBeerBaseName();
        expect(name).toMatch(/^[A-Z][a-z]+_[A-Z][a-z]+(_\d+)?$/);
      }
      const samples = new Set<string>();
      for (let i = 0; i < 200; i++) samples.add(generateBeerBaseName());
      expect(samples.size).toBeGreaterThan(50); // 20 nouns × 20 descriptors
    });

    it('always satisfies UsernameSchema (no hyphens/spaces)', () => {
      for (let i = 0; i < SAMPLES; i++) {
        expect(UsernameSchema.safeParse(generateBeerBaseName()).success).toBe(true);
      }
    });

    it('fallback path with 3-digit variant suffix still fits', () => {
      // Worst case: variant 99 renders "_100" (4 chars incl. underscore).
      const name = generateBeerBaseName(99);
      expect(name.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
    });
  });

  describe('generateBossName', () => {
    it('always fits the varchar(20) username column', () => {
      for (let i = 0; i < SAMPLES; i++) {
        const name = generateBossName();
        expect(name.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
      }
    });

    it('keeps the BOSS_ prefix for visibility', () => {
      for (let i = 0; i < SAMPLES; i++) {
        // Core may be a single word or an underscored Prefix_Suffix composition.
        expect(generateBossName()).toMatch(/^BOSS_[A-Za-z]+(_[A-Za-z]+)*(_\d{1,3})?$/);
      }
    });

    it('always satisfies UsernameSchema (no hyphens/spaces)', () => {
      for (let i = 0; i < SAMPLES; i++) {
        expect(UsernameSchema.safeParse(generateBossName()).success).toBe(true);
      }
    });
  });
});
