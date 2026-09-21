// Lists the animals whose image needs a human look, grouped by what to do.
//   node tools/report.mjs          # grouped report
//   node tools/report.mjs --all    # also list the animals with no issues
// "PICTURE" entries come from tools/manual-notes.json (visual review); the rest are computed flags.
import fs from 'node:fs';
import path from 'node:path';
import { flagsFor } from './flags.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const recs = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/images.json'), 'utf8'));
const notesPath = path.join(ROOT, 'tools/manual-notes.json');
const manual = fs.existsSync(notesPath) ? JSON.parse(fs.readFileSync(notesPath, 'utf8')) : {};

const groups = { missing: [], picture: [], licence: [], minor: [], ok: [] };
for (const r of recs) {
  if (!r.localFile) { groups.missing.push([r.animal, r.note || r.status]); continue; }
  const flags = flagsFor(r, r.animal);
  if (manual[r.animal]) { groups.picture.push([r.animal, manual[r.animal]]); continue; }
  const lic = flags.filter(f => f.startsWith('licence'));
  if (lic.length) { groups.licence.push([r.animal, lic.join('; ') + (r.author ? '  — ' + r.author : '')]); continue; }
  if (flags.length) { groups.minor.push([r.animal, flags.join('; ')]); continue; }
  groups.ok.push([r.animal, '']);
}
const show = (title, rows) => { if (!rows.length) return; console.log(`\n${title} (${rows.length})`); rows.forEach(([a, n]) => console.log('  ' + a.padEnd(24) + n)); };
show('NO IMAGE — find one', groups.missing);
show('BAD PICTURE — choose another photo', groups.picture);
show('LICENCE TO CHECK — photo is fine (often dual-licensed with CC)', groups.licence);
show('MINOR AUTO-FLAGS — visually reviewed, probably fine', groups.minor);
if (process.argv[2] === '--all') show('OK', groups.ok);
console.log(`\n${recs.length} animals: ${groups.ok.length + groups.minor.length} fine, ${groups.licence.length} licence check, ${groups.picture.length} bad picture, ${groups.missing.length} missing`);
console.log('Fix one with: node tools/set-image.mjs "Animal" "File:Name.jpg"   (clears its note)');
