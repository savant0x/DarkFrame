import re

# @file scripts/fix_game_types_ut.py
# @overview Fix UnitType from type-only to const+type, update UNIT_TYPE_ARCHETYPE and UNIT_CONFIGS

with open('types/game.types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ---- 1. Replace UnitType type + NewUnitType const with unified const + type ----
old_unit_type_block = """/**
 * Unit type — derived directly from Supabase DB enum.
 * This ensures zero type mismatches between TypeScript and PostgreSQL.
 * Contains all 65 DB unit type values for backward compatibility.
 */
export type UnitType = Database['public']['Enums']['unit_type'];

/**
 * New archetype-based unit types for the redesigned system.
 * These map 1:1 to DB unit_type values above.
 * Use these constants in code; the full UnitType union is for DB compatibility.
 */
export const NewUnitType = {
  // ===== STRIKER ARCHETYPE (Offense Focus) =====
  S_T1_VanguardInfantry: 'T1_RIFLEMAN' as const,
  S_T2_AssaultArmor: 'T2_COMMANDO' as const,
  S_T3_PlasmaGunship: 'T3_STRIKER' as const,
  S_T4_OrbitalDestroyer: 'T4_TITAN' as const,
  S_T5_SingularityTitan: 'T5_OVERLORD' as const,
  // ===== BULWARK ARCHETYPE (Defense Focus) =====
  B_T1_AegisDrone: 'T1_BUNKER' as const,
  B_T2_PhalanxMech: 'T2_FORTRESS' as const,
  B_T3_ShieldCruiser: 'T3_CITADEL' as const,
  B_T4_VoidBastion: 'T4_STRONGHOLD' as const,
  B_T5_CitadelLeviathan: 'T5_BASTION' as const,
  // ===== ARTILLERY ARCHETYPE (Anti-Support Focus) =====
  A_T1_MortarSquad: 'T1_TURRET' as const,
  A_T2_RocketBattery: 'T2_CANNON' as const,
  A_T3_RailgunEmplacement: 'T3_ARTILLERY' as const,
  A_T4_OrbitalStrike: 'T4_DREADNOUGHT' as const,
  A_T5_AnnihilatorCannon: 'T5_LEVIATHAN' as const,
  // ===== SUPPORT ARCHETYPE (Multiplier/Buffer) =====
  U_T1_CommsRelay: 'T1_SHIELD' as const,
  U_T2_TacticalLink: 'T2_SENTINEL' as const,
  U_T3_CommandNetwork: 'T3_GUARDIAN' as const,
  U_T4_WarCouncil: 'T4_COLOSSUS' as const,
  U_T5_SupremeCommand: 'T5_IMMORTAL' as const,
} as const;"""

new_unit_type_block = """export const UnitType = {
  // ===== STRIKER ARCHETYPE (Offense Focus) =====
  S_T1_VanguardInfantry: 'T1_RIFLEMAN' as const,
  S_T2_AssaultArmor: 'T2_COMMANDO' as const,
  S_T3_PlasmaGunship: 'T3_STRIKER' as const,
  S_T4_OrbitalDestroyer: 'T4_TITAN' as const,
  S_T5_SingularityTitan: 'T5_OVERLORD' as const,
  // ===== BULWARK ARCHETYPE (Defense Focus) =====
  B_T1_AegisDrone: 'T1_BUNKER' as const,
  B_T2_PhalanxMech: 'T2_FORTRESS' as const,
  B_T3_ShieldCruiser: 'T3_CITADEL' as const,
  B_T4_VoidBastion: 'T4_STRONGHOLD' as const,
  B_T5_CitadelLeviathan: 'T5_BASTION' as const,
  // ===== ARTILLERY ARCHETYPE (Anti-Support Focus) =====
  A_T1_MortarSquad: 'T1_TURRET' as const,
  A_T2_RocketBattery: 'T2_CANNON' as const,
  A_T3_RailgunEmplacement: 'T3_ARTILLERY' as const,
  A_T4_OrbitalStrike: 'T4_DREADNOUGHT' as const,
  A_T5_AnnihilatorCannon: 'T5_LEVIATHAN' as const,
  // ===== SUPPORT ARCHETYPE (Multiplier/Buffer) =====
  U_T1_CommsRelay: 'T1_SHIELD' as const,
  U_T2_TacticalLink: 'T2_SENTINEL' as const,
  U_T3_CommandNetwork: 'T3_GUARDIAN' as const,
  U_T4_WarCouncil: 'T4_COLOSSUS' as const,
  U_T5_SupremeCommand: 'T5_IMMORTAL' as const,
} as const;

export type UnitType = typeof UnitType[keyof typeof UnitType];"""

assert old_unit_type_block in content, "Could not find old UnitType block"
content = content.replace(old_unit_type_block, new_unit_type_block)
print("Replaced UnitType type + NewUnitType with unified const + type")

# ---- 2. Replace UNIT_TYPE_ARCHETTE with 20-value version ----
old_archetype_start = "export const UNIT_TYPE_ARCHETTE: Record<UnitType, UnitArchetype> = {"
assert old_archetype_start in content, "Could not find UNIT_TYPE_ARCHETTE"

# Find the block
archetype_start = content.find(old_archetype_start)
# Find the closing };
# We look for the first "};\n" after the start
archetype_end = content.find("};\n", archetype_start)
# Make sure we include trailing newline
if archetype_end != -1:
    archetype_end += 3  # include "};\n"
else:
    # fallback: just find "};"
    archetype_end = content.find("};", archetype_start) + 2

old_archetype_block = content[archetype_start:archetype_end]
print(f"Found UNIT_TYPE_ARCHETTE block: {len(old_archetype_block)} chars")

new_archetype_block = """export const UNIT_TYPE_ARCHETTE: Record<UnitType, UnitArchetype> = {
  // Strikers
  'T1_RIFLEMAN': 'STRIKER',
  'T2_COMMANDO': 'STRIKER',
  'T3_STRIKER': 'STRIKER',
  'T4_TITAN': 'STRIKER',
  'T5_OVERLORD': 'STRIKER',
  // Bulwarks
  'T1_BUNKER': 'BULWARK',
  'T2_FORTRESS': 'BULWARK',
  'T3_CITADEL': 'BULWARK',
  'T4_STRONGHOLD': 'BULWARK',
  'T5_BASTION': 'BULWARK',
  // Artillery
  'T1_TURRET': 'ARTILLERY',
  'T2_CANNON': 'ARTILLERY',
  'T3_ARTILLERY': 'ARTILLERY',
  'T4_DREADNOUGHT': 'ARTILLERY',
  'T5_LEVIATHAN': 'ARTILLERY',
  // Support
  'T1_SHIELD': 'SUPPORT',
  'T2_SENTINEL': 'SUPPORT',
  'T3_GUARDIAN': 'SUPPORT',
  'T4_COLOSSUS': 'SUPPORT',
  'T5_IMMORTAL': 'SUPPORT',
};\n"""

content = content[:archetype_start] + new_archetype_block + content[archetype_end:]
print("Replaced UNIT_TYPE_ARCHETTE with 20-value version")

# ---- 3. Change UnitConfig.type from string to UnitType ----
content = content.replace(
    "  type: string;\n  name: string;\n  archetype: UnitArchetype;",
    "  type: UnitType;\n  name: string;\n  archetype: UnitArchetype;",
    1  # only replace first occurrence
)
print("Changed UnitConfig.type from string to UnitType")

# ---- 4. Remove `as UnitType` casts in UNIT_CONFIGS entries ----
# Replace `type: '...' as UnitType,` with `type: '...',`
content = re.sub(r"type: ('T[1-5]_[A-Z_]+') as UnitType,", r"type: \1,", content)
print("Removed `as UnitType` casts from UNIT_CONFIGS")

with open('types/game.types.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! File updated.")
