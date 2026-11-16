// Deterministic frame renderer (headless Chromium + software WebGL).
// Usage: node render.mjs --module /project/scenes/s1.js --project <dir> --dur 6.1 --out <dir>
//        [--fps 24] [--w 1080] [--h 1920] [--params <base64 json>] [--frames 0,40,80] [--start N]
// Writes frames atomically (tmp file + rename) so an interrupted render never leaves a truncated PNG.
// --start resumes from frame N (frames already on disk before N are kept).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { extname, join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const mod = arg('module'), projectRoot = resolve(arg('project', '.')), dur = Number(arg('dur', 5));
const fps = Number(arg('fps', 24)), w = Number(arg('w', 1080)), h = Number(arg('h', 1920));
const out = resolve(arg('out')), params = arg('params', ''), start = Number(arg('start', 0));
const only = arg('frames') ? arg('frames').split(',').map(Number) : null;
if (!mod || !arg('out')) { console.error('usage: --module <url> --out <dir> [--project <dir>]'); process.exit(2); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };

const serveFrom = (root, rel) => { const p = resolve(root, '.' + sep + rel); if (!p.startsWith(root + sep) && p !== root) throw new Error('outside root'); return p; };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let p;
    if (url.startsWith('/engine/')) p = serveFrom(engineRoot, url.slice(8));
    else if (url.startsWith('/project/')) p = serveFrom(projectRoot, url.slice(9));
    else throw new Error('not found');
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
let failed = false;
page.on('pageerror', (e) => { failed = true; console.error(JSON.stringify({ level: 'error', event: 'page_error', message: e.message })); });
page.on('console', (m) => { if (m.type() === 'error') { failed = true; console.error(JSON.stringify({ level: 'error', event: 'console', message: m.text() })); } });
const qs = new URLSearchParams({ module: mod, dur: String(dur), fps: String(fps), w: String(w), h: String(h) });
if (params) qs.set('params', params);
await page.goto(`http://127.0.0.1:${server.address().port}/engine/index.html?${qs}`);
await page.waitForFunction('window.READY === true', null, { timeout: 180000 });
const total = await page.evaluate('window.FRAMES');
await mkdir(out, { recursive: true });
const t0 = Date.now();
const list = only ?? [...Array(total).keys()].filter((i) => i >= start);
for (const i of list) {
  const url = await page.evaluate((n) => window.renderFrame(n), i);
  const f = join(out, `f${String(i).padStart(4, '0')}.png`);
  await writeFile(f + '.tmp', Buffer.from(url.split(',')[1], 'base64'));
  await rename(f + '.tmp', f);
  if (!only && i % 48 === 0) console.log(JSON.stringify({ level: 'info', event: 'frame', module: mod, frame: i, total, elapsed_s: (Date.now() - t0) / 1000 }));
}
await browser.close(); server.close();
console.log(JSON.stringify({ level: 'info', event: 'render_done', module: mod, frames: list.length, total, elapsed_s: (Date.now() - t0) / 1000 }));
if (failed) process.exit(1);
