// Runs after `astro build`: shrinks the photos and covers in dist/images so the
// live site stays fast, even when a large phone photo is uploaded through /admin.
// Source files in public/ are never changed; only the built copies are.
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = 'dist/images';
const MAX_WIDTH = 1400; // largest size any image is shown at (2x for sharp screens)
const MAX_HEIGHT = 1800;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let saved = 0;
for await (const file of walk(ROOT)) {
  const ext = extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

  const before = (await stat(file)).size;
  const image = sharp(file, { failOn: 'none' }).rotate().resize({
    width: MAX_WIDTH,
    height: MAX_HEIGHT,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const out =
    ext === '.png'
      ? await image.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer()
      : ext === '.webp'
        ? await image.webp({ quality: 80 }).toBuffer()
        : await image.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toBuffer();

  // Only keep the new version when it is actually smaller.
  if (out.length < before) {
    await writeFile(file, out);
    saved += before - out.length;
    console.log(`  ${file}: ${Math.round(before / 1024)} KB → ${Math.round(out.length / 1024)} KB`);
  }
}
console.log(`optimize-images: saved ${Math.round(saved / 1024)} KB`);
