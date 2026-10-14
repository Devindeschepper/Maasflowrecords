// Builds dist/press/maas-flow-records-press-kit.zip after `astro build`, so the press kit always holds the
// current bios, facts and photos. Logos live in public/press/, press photos in public/images/artists/.
// Small ZIP writer (stored, no compression: JPG/PNG are already compressed), no extra dependency.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist/press/maas-flow-records-press-kit.zip');

const { artists } = JSON.parse(readFileSync(join(root, 'src/content/artists.json'), 'utf8'));
const { labelBio } = JSON.parse(readFileSync(join(root, 'src/content/press.json'), 'utf8'));
const vin = artists[0];
const names = { spotify: 'Spotify', appleMusic: 'Apple Music', youtubeMusic: 'YouTube Music', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', soundcloud: 'SoundCloud', deezer: 'Deezer', amazonMusic: 'Amazon Music', tidal: 'Tidal' };
const links = (o) => Object.entries(o ?? {}).filter(([, v]) => v).map(([k, v]) => `  ${names[k] ?? k}: ${v}`).join('\n');
const { labelSocials } = JSON.parse(readFileSync(join(root, 'src/content/settings.json'), 'utf8'));

const readme = `MAAS FLOW RECORDS - PRESS KIT
maasflowrecords.com/press/

QUICK FACTS
  Label: Maas Flow Records (independent)
  Founder: VIN
  Main artist: ${vin.name} - ${vin.roles.join(', ').toLowerCase()}
  From: ${vin.origin}
  Genre: Hip-hop / rap
  Website: https://maasflowrecords.com

VIN - SHORT BIO
${vin.description}
Full bio: https://maasflowrecords.com/bio/

MAAS FLOW RECORDS - SHORT BIO
${labelBio}

LISTEN
${links(vin.streaming)}

FOLLOW VIN
${links(vin.socials)}

FOLLOW MAAS FLOW RECORDS
${links(labelSocials)}

CONTACT
  Interviews, radio, playlists, features and bookings: info@maasflowrecords.com
  Contact form: https://maasflowrecords.com/contact/

USE
  Bios, photos and logos may be used for articles, posts and event promotion about VIN and
  Maas Flow Records. Please don't change the logos.
`;

const files = [['README.txt', Buffer.from(readme.replace(/\n/g, '\r\n'), 'utf8')]];
for (const f of readdirSync(join(root, 'public/press')).sort()) files.push([`logos/${f}`, readFileSync(join(root, 'public/press', f))]);
for (const f of readdirSync(join(root, 'public/images/artists')).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()) {
  files.push([`photos/${f}`, readFileSync(join(root, 'public/images/artists', f))]);
}

// --- ZIP (store) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const d = new Date();
const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

const parts = [];
const central = [];
let offset = 0;
for (const [name, data] of files) {
  const n = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
  local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26); local.writeUInt16LE(0, 28);
  parts.push(local, n, data);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
  c.writeUInt16LE(dosTime, 12); c.writeUInt16LE(dosDate, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20);
  c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, n);
  offset += 30 + n.length + data.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);

if (!existsSync(join(root, 'dist/press'))) mkdirSync(join(root, 'dist/press'), { recursive: true });
writeFileSync(out, Buffer.concat([...parts, cd, end]));
console.log(`press-kit: ${files.length} files, ${(offset / 1024).toFixed(0)} KB -> dist/press/maas-flow-records-press-kit.zip`);
