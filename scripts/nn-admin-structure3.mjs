// NEON NOIR admin pass 3 — remaining emoji and big-glyph tiles.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// select options: emoji -> plain text
src = src.replace(/>✅ Enabled</g, '>Enabled<');
src = src.replace(/>❌ Disabled</g, '>Disabled<');
src = src.replace(/>✅ Dynamic Schedules</g, '>Dynamic Schedules<');

// section/panel micro-titles with emoji
src = src.replace(/📅 Dynamic Respawn Schedules/g, 'Dynamic Respawn Schedules');
src = src.replace(/🍺 Manual Respawn Now/g, 'Manual Respawn Now');
src = src.replace(/{beerAnalyticsLoading \? '⟳' : '🔄'} Refresh/g, "{beerAnalyticsLoading ? 'LOADING' : 'REFRESH'}");
src = src.replace(/❌ Error: \{beerAnalyticsError\}/g, 'Error: {beerAnalyticsError}');
src = src.replace(/⚔️ Defeats by Tier/g, 'Defeats by Tier');
src = src.replace(/🏆 Top Beer Base Hunters/g, 'Top Beer Base Hunters');
src = src.replace(/ ⚡\n/g, '\n');
src = src.replace(/ ⚡`/g, '`');
src = src.replace(/'❌ Failed to adjust RP'/g, "'Failed to adjust RP'");
src = src.replace(/⚠️ Active Alerts/g, 'Active Alerts');
src = src.replace(/⚠️ Balance Warnings/g, 'Balance Warnings');
src = src.replace(/⚠ /g, 'ALERT · ');
src = src.replace(/<span className="text-2xl">\{beerBaseConfig.usePredictiveSpawning \? '🔮' : '📊'\}<\/span>/g, "<span className='nn-panel__title'>{beerBaseConfig.usePredictiveSpawning ? 'PREDICTIVE' : 'DISTRIBUTED'}</span>");
src = src.replace(/<span className="text-lg">⚠️<\/span>/g, '<span className="nn-panel__title">ALERT</span>');

// RP economy stat tiles: big emoji glyphs -> nn-lab labels
src = src.replace(/<div className="text-2xl">💰<\/div>/g, '<div className="nn-lab">TOTAL RP</div>');
src = src.replace(/<div className="text-2xl">👥<\/div>/g, '<div className="nn-lab">HOLDERS</div>');

// WMD alert banner inside nn-note
writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 3 applied' : 'no changes');
