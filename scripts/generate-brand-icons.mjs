import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(path.join(root, 'src/app/icon.svg'));
await mkdir(path.join(root, 'public/icons'), { recursive: true });
for (const size of [180, 192, 512]) {
  const target = size === 180 ? 'src/app/apple-icon.png' : `public/icons/icon-${size}.png`;
  await writeFile(path.join(root, target), await (size === 512 ? sharp(svg).resize(448, 448).extend({ top: 32, bottom: 32, left: 32, right: 32, background: '#c4470a' }) : sharp(svg).resize(size, size)).flatten({ background: '#c4470a' }).png().toBuffer());
}
const images = await Promise.all([16, 32, 48].map(size => sharp(svg).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (let i = 0; i < images.length; i++) {
  const size = [16, 32, 48][i], entry = 6 + i * 16;
  header.writeUInt8(size, entry); header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[i].length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
}
await writeFile(path.join(root, 'src/app/favicon.ico'), Buffer.concat([header, ...images]));
console.log('Ícones gerados: favicon ICO 16/32/48, SVG, Apple 180 e app 192/512.');
