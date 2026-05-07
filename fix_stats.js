const fs = require('fs');
let s = fs.readFileSync('components/StatsPanel.tsx', 'utf8');

// Fix header const - remove bg-white/5 since gradient overrides it
s = s.replace('const header = "bg-white/5 border-b border-white/10 px-3 py-1.5"', 'const header = "border-b border-white/10 px-3 py-1.5"');

// Fix Military Power card: p-2 -> p-2.5
s = s.replace(/\{\/\* Military Power \*\/\}\n      <div className="bg-\[--shadow\] border border-white\/10 rounded-lg overflow-hidden">\n        <div className=\{`\$\{header\} bg-gradient-to-r from-\[--neon-red\]\/10 to-transparent`\}>\n          <h3 className=\{headerText\}><Swords className="w-3\.5 h-3\.5" \/\> MILITARY POWER<\/h3>\n        <\/div>\n        <div className="p-2">/s, '{/* Military Power */}\n      <div className="bg-[--shadow] border border-white/10 rounded-lg overflow-hidden">\n        <div className={`${header} bg-gradient-to-r from-[--neon-red]/10 to-transparent`}>\n          <h3 className={headerText}><Swords className="w-3.5 h-3.5" /> MILITARY POWER</h3>\n        </div>\n        <div className="p-2.5">');

// Fix text-white/60 -> text-white/70 for labels
s = s.replace(/<span className="text-white\/60">/g, '<span className="text-white/70">');

// Fix bg-white/5 on shrine buff rows -> bg-white/[0.03]
s = s.replace(/className="flex justify-between px-2 py-1\.5 rounded bg-white\/5 border border-white\/5"/g, 'className="flex justify-between px-2 py-1.5 rounded bg-white/[0.03] border border-white/10"');

// Fix alternating Military Power table rows
s = s.replace(/<tr className="border-b border-white\/5">/g, '<tr className="border-b border-white/5 bg-white/[0.03]">');
s = s.replace(/<tr>\n\s*<td className="px-2 py-1 text-white\/70">Defense/g, '<tr className="bg-white/[0.06]">\n                <td className="px-2 py-1 text-white/70">Defense');

// Fix border-white/5 in shrine total -> border-white/10
s = s.replace(/border-t border-white\/5 pt-1\.5/g, 'border-t border-white/10 pt-1.5');

fs.writeFileSync('components/StatsPanel.tsx', s, 'utf8');
console.log('StatsPanel fixed ' + s.length);
