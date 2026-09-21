// Shrinks an image for the game: max 480px on the long side, JPEG quality 70 (uses macOS `sips`).
// If sips isn't available the file is copied unchanged.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const MAX_SIZE = 480;
export const QUALITY = 70;

export function shrink(src, dest) {
  const tmp = dest + '.tmp.jpg';
  try {
    execFileSync('sips', ['-Z', String(MAX_SIZE), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), src, '--out', tmp], { stdio: 'ignore' });
    fs.renameSync(tmp, dest);
  } catch {
    fs.rmSync(tmp, { force: true });
    if (src !== dest) fs.copyFileSync(src, dest);
  }
  if (src !== dest) fs.rmSync(src, { force: true });
}

/** Pixel size of an image via sips, or null. */
export function dims(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
    return { width: +/pixelWidth: (\d+)/.exec(out)[1], height: +/pixelHeight: (\d+)/.exec(out)[1] };
  } catch { return null; }
}
