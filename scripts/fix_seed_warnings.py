import re

with open('scripts/reset-and-seed.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add 'discoveries' to wipe list (already done, but add if missing)
if "'discoveries'" not in content:
    content = content.replace(
        "'game_config', 'seeds', 'player_units',",
        "'game_config', 'seeds', 'player_units', 'discoveries',"
    )
    print("Added 'discoveries' to wipe list")

# 2. Fix prestigeValue -> prestige_value
content = content.replace('prestigeValue:', 'prestige_value:')
print("Fixed prestigeValue -> prestige_value")

# 3. Remove sacrificed_digger_count
content = content.replace(
    'sacrificed_metal_bonus: 0, sacrificed_energy_bonus: 0, sacrificed_digger_count: 0,',
    'sacrificed_metal_bonus: 0, sacrificed_energy_bonus: 0,'
)
print("Removed sacrificed_digger_count")

# 4. Fix flag bearer_id FK violation - use a non-existent placeholder that won't fail
# The FK references players table, and there are no players at seed time (admin created later)
# Change to use a UUID format that Supabase won't try to validate
# Actually, the issue is that bearer_id is a text column with FK to players.username
# Since no players exist yet, use the admin username that WILL be created
content = content.replace(
    "bearer_id: 'SYSTEM',",
    "bearer_id: 'spencerhowell84@gmail.com',"
)
print("Fixed flag bearer_id to use admin username")

with open('scripts/reset-and-seed.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("All fixes applied!")
