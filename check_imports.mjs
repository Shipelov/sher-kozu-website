import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || 'dist/public/assets';
const target = process.argv[3] || 'vendor-markdown-vf8yFouH';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes(target));
const importers = [];
for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  if (content.includes(target)) {
    importers.push(f);
  }
}
console.log('Files that reference ' + target + ':', importers);
