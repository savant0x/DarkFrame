-- FID-20260912-076: clan_wars — the real war ledger.
-- Wars previously existed only as WAR_DECLARED entries in mod_log; reads were
-- stubs and endWar threw. This table is the single source of truth for the
-- War Engine v2 lifecycle (declare -> active -> settled/truced).
-- Applied at boot by lib/migrations/clanWars.ts (CREATE TABLE IF NOT EXISTS +
-- column-existence guards, matching the factorySlots self-heal pattern).

CREATE TABLE IF NOT EXISTS clan_wars (
  war_id              varchar(80) PRIMARY KEY,
  attacker_clan_id    varchar(64)  NOT NULL,
  attacker_name       varchar(50)  NOT NULL DEFAULT '',
  attacker_tag        varchar(10)  NOT NULL DEFAULT '',
  defender_clan_id    varchar(64)  NOT NULL,
  defender_name       varchar(50)  NOT NULL DEFAULT '',
  defender_tag        varchar(10)  NOT NULL DEFAULT '',
  status              varchar(16)  NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | ENDED | TRUCE
  declared_at         timestamp    NOT NULL DEFAULT now(),
  declared_by         varchar(20)  NOT NULL DEFAULT '',
  ended_at            timestamp,
  ended_reason        varchar(32),
  outcome             varchar(16),                               -- ATTACKER_WIN | DEFENDER_WIN | TRUCE
  declaration_cost    jsonb        NOT NULL DEFAULT '{"metal":0,"energy":0}',
  attacker_score      integer      NOT NULL DEFAULT 0,
  defender_score      integer      NOT NULL DEFAULT 0,
  attacker_captures   integer      NOT NULL DEFAULT 0,
  defender_captures   integer      NOT NULL DEFAULT 0,
  capture_day         varchar(10)  NOT NULL DEFAULT '',         -- YYYY-MM-DD of the attempt-day counters
  attacker_captures_today integer  NOT NULL DEFAULT 0,
  defender_captures_today integer  NOT NULL DEFAULT 0,
  attacker_truce_proposed smallint NOT NULL DEFAULT 0,  -- 0/1 (smallint boolean, matches drizzle schema)
  defender_truce_proposed smallint NOT NULL DEFAULT 0,  -- 0/1
  spoils              jsonb,
  created_at          timestamp    NOT NULL DEFAULT now(),
  updated_at          timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clan_wars_attacker_idx  ON clan_wars (attacker_clan_id, status);
CREATE INDEX IF NOT EXISTS clan_wars_defender_idx  ON clan_wars (defender_clan_id, status);
CREATE INDEX IF NOT EXISTS clan_wars_status_idx    ON clan_wars (status, declared_at);
