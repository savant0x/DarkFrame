import re

with open('types/game.types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Map unit config keys to descriptions
descriptions = {
    'T1_RIFLEMAN': 'Basic infantry. Deals 130% damage to Bulwarks in combat.',
    'T2_COMMANDO': 'Elite assault armor. High STR damage, counters defensive lines.',
    'T3_STRIKER': 'Plasma-armed gunship. Devastating offensive power.',
    'T4_TITAN': 'Orbital destroyer. Massive STR output against hardened targets.',
    'T5_OVERLORD': 'Singularity-powered titan. Absolute offensive supremacy.',
    'T1_BUNKER': 'Frontline bunker. High DEF absorbs incoming damage for allies.',
    'T2_FORTRESS': 'Phalanx mech. Reinforced defense for holding the line.',
    'T3_CITADEL': 'Shield cruiser. Mobile fortress with exceptional durability.',
    'T4_STRONGHOLD': 'Void bastion. Nearly impenetrable defensive position.',
    'T5_BASTION': 'Citadel leviathan. Ultimate defensive bulwark.',
    'T1_TURRET': 'Auto-turret. Strikes enemy Support units first in combat.',
    'T2_CANNON': 'Rocket battery. Suppresses support lines with barrages.',
    'T3_ARTILLERY': 'Railgun emplacement. Precision anti-support strikes.',
    'T4_DREADNOUGHT': 'Orbital strike platform. Devastates support formations.',
    'T5_LEVIATHAN': 'Annihilator cannon. Erases entire support networks.',
    'T1_SHIELD': 'Comms relay. Amplifies allied STR/DEF in combat (up to +60%).',
    'T2_SENTINEL': 'Tactical link. Enhances unit coordination and effectiveness.',
    'T3_GUARDIAN': 'Command network. Directs battlefield with advanced tactics.',
    'T4_COLOSSUS': 'War council. Orchestrates large-scale combat operations.',
    'T5_IMMORTAL': 'Supreme command. Transcendent battlefield coordination.',
}

# For each key, find the block starting with `'KEY': {`
# and add `description: '...',` after the `name:` line
for key, desc in descriptions.items():
    old = f"'{key}': {{\n    type: '{key}',\n    name:"
    new = f"'{key}': {{\n    type: '{key}',\n    description: '{desc}',\n    name:"
    
    if old in content:
        content = content.replace(old, new, 1)
        print(f"  Added description for {key}")
    else:
        # Try alternative pattern
        print(f"  WARNING: Could not find {key}")

with open('types/game.types.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
