// Triage flags: things worth a human look. Not proof of a problem.
const BAD_TITLE = /composite|collage|montage|diagram|skeleton|skull|illustration|drawing|painting|engraving|lithograph|\bmap\b|range|distribution|specimen|taxiderm|museum|fossil|cladogram|plate\b|stamp|logo/i;
export function flagsFor(rec, name) {
  const f = [];
  if (rec.status === 'review') f.push('licence: ' + (rec.license || 'unknown'));
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
  const a = norm(name), w = norm(rec.wikiTitle || '');
  if (w && !(w.includes(a) || a.includes(w))) f.push('page differs: ' + rec.wikiTitle);
  if (rec.width && Math.max(rec.width, rec.height || 0) < 300) f.push('small: ' + rec.width + 'x' + rec.height + 'px');
  const ratio = rec.width && rec.height ? rec.width / rec.height : 1;
  if (ratio > 2.2 || ratio < 0.55) f.push('odd shape: ' + ratio.toFixed(2));
  if (BAD_TITLE.test((rec.title || '') + ' ' + (rec.file || ''))) f.push('title suggests non-photo/composite');
  if (/\.svg$/i.test(rec.file || '')) f.push('svg (drawing)');
  return f;
}


export function classify(license, nonFree) {
  if (nonFree) return 'review';
  const l = (license || '').trim();
  if (/-NC|-ND|\bNC\b|\bND\b/i.test(l)) return 'review';
  if (/^(public domain|pd\b|cc0|cc[- ]by(-sa)?[- ][\d.]+)/i.test(l)) return 'ok';
  return 'review';
}

