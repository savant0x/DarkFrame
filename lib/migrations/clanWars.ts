/**
 * @file lib/migrations/clanWars.ts
 * @created 2026-09-12
 * @overview FID-20260912-076 — boot self-heal creating the clan_wars table
 * (War Engine v2 ledger). Raw .sql is the record; this TS runner applies it
 * at boot (factorySlots/factoryStatResync pattern). Idempotent.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

let applied = false;

export async function runClanWarsMigration(): Promise<{ message: string; alreadyApplied: boolean }> {
  if (applied) {
    return { message: 'clan_wars already ensured this process', alreadyApplied: true };
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS clan_wars (
      war_id              varchar(80) PRIMARY KEY,
      attacker_clan_id    varchar(64)  NOT NULL,
      attacker_name       varchar(50)  NOT NULL DEFAULT '',
      attacker_tag        varchar(10)  NOT NULL DEFAULT '',
      defender_clan_id    varchar(64)  NOT NULL,
      defender_name       varchar(50)  NOT NULL DEFAULT '',
      defender_tag        varchar(10)  NOT NULL DEFAULT '',
      status              varchar(16)  NOT NULL DEFAULT 'ACTIVE',
      declared_at         timestamp    NOT NULL DEFAULT now(),
      declared_by         varchar(20)  NOT NULL DEFAULT '',
      ended_at            timestamp,
      ended_reason        varchar(32),
      outcome             varchar(16),
      declaration_cost    jsonb        NOT NULL DEFAULT '{"metal":0,"energy":0}',
      attacker_score      integer      NOT NULL DEFAULT 0,
      defender_score      integer      NOT NULL DEFAULT 0,
      attacker_captures   integer      NOT NULL DEFAULT 0,
      defender_captures   integer      NOT NULL DEFAULT 0,
      capture_day         varchar(10)  NOT NULL DEFAULT '',
      attacker_captures_today integer  NOT NULL DEFAULT 0,
      defender_captures_today integer  NOT NULL DEFAULT 0,
      attacker_truce_proposed smallint NOT NULL DEFAULT 0,
      defender_truce_proposed smallint NOT NULL DEFAULT 0,
      spoils              jsonb,
      created_at          timestamp    NOT NULL DEFAULT now(),
      updated_at          timestamp    NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS clan_wars_attacker_idx ON clan_wars (attacker_clan_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS clan_wars_defender_idx ON clan_wars (defender_clan_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS clan_wars_status_idx ON clan_wars (status, declared_at)`);

  applied = true;
  return { message: 'clan_wars table ensured (War Engine v2 ledger)', alreadyApplied: false };
}
