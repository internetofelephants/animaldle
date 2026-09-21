// Attach a hand-picked Wikimedia Commons photo to an animal (replaces its current image + credit).
//   node tools/set-image.mjs "Hummingbird" "File:Anna's_Hummingbird.jpg"
//   node tools/set-image.mjs "Hummingbird" "https://commons.wikimedia.org/wiki/File:Anna's_Hummingbird.jpg"
// Downloads an 800px copy to images/, updates images/images.json (licence, author, source link),
// recomputes flags, and prints what it stored so you can check the licence.
import fs from 'node:fs';
import path from 'node:path';
import { flagsFor, classify } from './flags.mjs';
import { shrink, dims } from './shrink.mjs';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'images');
const JSON_PATH = path.join(OUT, 'images.json');
const UA = 'AnimaldlePrototype/0.1 (https://github.com/internetofelephants/animaldle; mygshah@gmail.com)';

const [animal, ref] = process.argv.slice(2);
if (!animal || !ref) { console.error('usage: node tools/set-image.mjs "Animal name" "File:Name.jpg" (or a Commons file URL)'); process.exit(1); }

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const stripTags = s => (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
let fileName = decodeURIComponent(ref.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//, '').replace(/^File:/i, '')).replace(/_/g, ' ');

const recs = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const idx = recs.findIndex(r => r.animal.toLowerCase() === animal.toLowerCase());
if (idx < 0) { console.error('No such animal in images.json:', animal); process.exit(1); }

const url = 'https://commons.wikimedia.org/w/api.php?action=query&titles=' + encodeURIComponent('File:' + fileName) +
  '&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=800&format=json';
const info = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
const ii = Object.values(info.query.pages)[0].imageinfo?.[0];
if (!ii) { console.error('Commons has no such file:', fileName); process.exit(1); }

const m = ii.extmetadata || {};
const old = recs[idx];
const rec = {
  animal: old.animal, wikiTitle: old.wikiTitle, file: 'File:' + fileName, sourceUrl: ii.descriptionurl,
  license: stripTags(m.LicenseShortName?.value), licenseUrl: stripTags(m.LicenseUrl?.value),
  author: stripTags(m.Artist?.value), credit: stripTags(m.Credit?.value), title: stripTags(m.ObjectName?.value),
  onCommons: true, manual: true,
};
rec.status = classify(rec.license, m.NonFree?.value === 'true');
const thumb = ii.thumburl || ii.url;
const ext = (path.extname(new URL(thumb).pathname) || '.jpg').toLowerCase();
const local = slug(animal) + '.jpg';
const img = await fetch(thumb, { headers: { 'User-Agent': UA } });
if (!img.ok) { console.error('download failed', img.status); process.exit(1); }
const tmp = path.join(OUT, slug(animal) + '.download' + ext);
fs.writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));
shrink(tmp, path.join(OUT, local));
if (old.localFile && old.localFile !== 'images/' + local) fs.rmSync(path.join(ROOT, old.localFile), { force: true });
rec.localFile = 'images/' + local;
const d = dims(path.join(OUT, local));
rec.width = d ? d.width : ii.thumbwidth; rec.height = d ? d.height : ii.thumbheight;
rec.flags = flagsFor(rec, animal);
recs[idx] = rec;
fs.writeFileSync(JSON_PATH, JSON.stringify(recs, null, 2));

// clear any manual note for this animal
const notesPath = path.join(ROOT, 'tools/manual-notes.json');
if (fs.existsSync(notesPath)) {
  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
  if (notes[old.animal]) { delete notes[old.animal]; fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2)); }
}
console.log(`${animal}: ${rec.localFile} (${rec.width}x${rec.height})\n  licence: ${rec.license} [${rec.status}]\n  author:  ${rec.author}\n  source:  ${rec.sourceUrl}` +
  (rec.flags.length ? '\n  flags:   ' + rec.flags.join('; ') : ''));
// refresh the game's photo manifest (this animal returns to the playable pool if the photo is now approved)
execFileSync(process.execPath, [path.join(ROOT, 'tools/build-photos.mjs')], { stdio: 'inherit' });
