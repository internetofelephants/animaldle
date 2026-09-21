// Pilot image retrieval: for each animal, take the lead image of its Wikipedia article,
// read licence/author from Wikimedia Commons, download an 800px copy, and record everything.
//
//   node tools/fetch-images.mjs            # every 4th animal (50 of 200)
//   node tools/fetch-images.mjs all        # all animals
//   node tools/fetch-images.mjs rest      # every animal not already in images/images.json
//   node tools/fetch-images.mjs "Lion,Tiger"   # named animals (re-fetches and replaces their entries)
// Results are merged into images/images.json, so runs accumulate. Each entry gets a "flags" list
// (things a human should look at); tools/report.mjs prints the flagged animals.
//
// Output: images/<slug>.jpg|png and images/images.json (attribution + licence status).
// status "ok"     = public domain / CC0 / CC BY / CC BY-SA (fine to display with credit)
// status "review" = anything else (NC/ND, non-free, unknown, or no Commons record) — prototype only.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { flagsFor, classify } from './flags.mjs';
import { shrink, dims } from './shrink.mjs';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'images');
const UA = 'AnimaldlePrototype/0.1 (https://github.com/internetofelephants/animaldle; mygshah@gmail.com)';
const WIDTH = 800;

// Wikipedia page titles where the animal's name alone is ambiguous or points at the wrong page.
const TITLE_OVERRIDES = JSON.parse(fs.existsSync(path.join(ROOT, 'tools/wiki-titles.json'))
  ? fs.readFileSync(path.join(ROOT, 'tools/wiki-titles.json'), 'utf8') : '{}');

const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/animals.js'), 'utf8') + '\nthis.ALL_ANIMALS = ALL_ANIMALS;', ctx);
const ALL_ANIMALS = ctx.ALL_ANIMALS;

const arg = process.argv[2];
const JSON_PATH = path.join(OUT, 'images.json');
const existing = fs.existsSync(JSON_PATH) ? JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) : [];
let names;
if (arg === 'rest') names = ALL_ANIMALS.map(a => a.name).filter(n => !existing.some(r => r.animal === n && r.localFile));
else if (arg === 'all') names = ALL_ANIMALS.map(a => a.name);
else if (arg) names = arg.split(',').map(s => s.trim());
else names = ALL_ANIMALS.filter((_, i) => i % 4 === 0).map(a => a.name);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const stripTags = s => (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function summaryFor(title) {
  try { return await getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))); }
  catch { return null; }
}

async function findPage(name) {
  const first = TITLE_OVERRIDES[name] || name;
  let s = await summaryFor(first);
  if (s && s.type === 'standard' && s.originalimage) return s;
  // fall back to search (ambiguous title, or page has no lead image)
  const q = encodeURIComponent(name + ' animal');
  const res = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json`);
  for (const hit of res.query.search) {
    s = await summaryFor(hit.title);
    if (s && s.type === 'standard' && s.originalimage) return s;
  }
  return null;
}

fs.mkdirSync(OUT, { recursive: true });
const results = [];

for (const name of names) {
  const rec = { animal: name };
  try {
    const page = await findPage(name);
    if (!page) { rec.status = 'missing'; rec.note = 'no Wikipedia page with a lead image'; results.push(rec); console.log('MISSING ', name); continue; }
    rec.wikiTitle = page.title;
    const src = page.originalimage.source;
    const onCommons = src.includes('/wikipedia/commons/');
    // Original: .../commons/a/a6/File.jpg   Thumbnail: .../commons/thumb/a/a6/File.jpg/800px-File.jpg (+ ?query)
    const parts = new URL(src).pathname.split('/');
    const t = parts.indexOf('thumb');
    const fileName = decodeURIComponent(t >= 0 ? parts[t + 3] : parts[parts.length - 1]);
    const api = onCommons ? 'https://commons.wikimedia.org/w/api.php' : 'https://en.wikipedia.org/w/api.php';
    const info = await getJson(`${api}?action=query&titles=${encodeURIComponent('File:' + fileName)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=${WIDTH}&format=json`);
    const p = Object.values(info.query.pages)[0];
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) { rec.status = 'missing'; rec.note = 'no imageinfo for ' + fileName; results.push(rec); console.log('NOINFO  ', name); continue; }
    const m = ii.extmetadata || {};
    rec.file = 'File:' + fileName;
    rec.sourceUrl = ii.descriptionurl;
    rec.license = stripTags(m.LicenseShortName && m.LicenseShortName.value);
    rec.licenseUrl = stripTags(m.LicenseUrl && m.LicenseUrl.value);
    rec.author = stripTags(m.Artist && m.Artist.value);
    rec.credit = stripTags(m.Credit && m.Credit.value);
    rec.title = stripTags(m.ObjectName && m.ObjectName.value);
    rec.onCommons = onCommons;
    rec.status = classify(rec.license, !onCommons || (m.NonFree && m.NonFree.value === 'true'));
    const thumb = ii.thumburl || ii.url;
    const ext = (path.extname(new URL(thumb).pathname) || '.jpg').toLowerCase();
    const local = slug(name) + '.jpg';
    const img = await fetch(thumb, { headers: { 'User-Agent': UA } });
    if (!img.ok) throw new Error('download ' + img.status);
    const tmp = path.join(OUT, slug(name) + '.download' + ext);
    fs.writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));
    shrink(tmp, path.join(OUT, local));
    rec.localFile = 'images/' + local;
    const d = dims(path.join(OUT, local));
    rec.width = d ? d.width : (ii.thumbwidth || ii.width); rec.height = d ? d.height : (ii.thumbheight || ii.height);
    rec.flags = flagsFor(rec, name);
    console.log((rec.flags.length ? 'FLAG    ' : 'ok      ') + name.padEnd(26) + rec.license + (rec.flags.length ? '   [' + rec.flags.join('; ') + ']' : ''));
  } catch (e) {
    rec.status = 'error'; rec.note = String(e.message || e);
    console.log('ERROR   ', name, rec.note);
  }
  results.push(rec);
  await sleep(250);
}

// merge: keep previous entries, replace any re-fetched ones, append new ones
const merged = existing.filter(r => !results.some(n => n.animal === r.animal)).concat(results);
fs.writeFileSync(JSON_PATH, JSON.stringify(merged, null, 2));
const tally = results.reduce((t, r) => (t[r.status] = (t[r.status] || 0) + 1, t), {});
console.log('\nFetched:', results.length, 'animals ->', JSON.stringify(tally), '| images.json now has', merged.length);
execFileSync(process.execPath, [path.join(ROOT, 'tools/build-photos.mjs')], { stdio: 'inherit' });
