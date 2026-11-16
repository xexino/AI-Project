// Deterministic frame renderer for engine/three scenes (headless Chromium, software WebGL).
// Usage: node render.mjs --scene s1 --dur 6.1 --out <dir> [--frames 0,40,80]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const scene = arg('scene'), dur = Number(arg('dur', 5)), out = resolve(arg('out', join(root, 'out', scene)));
const only = arg('frames') ? arg('frames').split(',').map(Number) : null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
let failed = false;
page.on('pageerror', (e) => { failed = true; console.error('PAGE ERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?scene=${scene}&dur=${dur}`);
await page.waitForFunction('window.READY === true || false', null, { timeout: 120000 });
const total = await page.evaluate('window.FRAMES');
await mkdir(out, { recursive: true });
const t0 = Date.now();
for (const i of only ?? [...Array(total).keys()]) {
  const url = await page.evaluate((n) => window.renderFrame(n), i);
  await writeFile(join(out, `f${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  if (!only && i % 48 === 0) console.log(`${scene}: frame ${i}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close(); server.close();
console.log(`${scene}: ${only ? only.length : total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed) process.exit(1);
