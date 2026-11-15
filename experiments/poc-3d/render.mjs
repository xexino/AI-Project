// Renders scene.html frame-by-frame with headless Chromium (software WebGL), then encodes with FFmpeg.
// Usage: node render.mjs [outDir] [--preview N]   (preview renders only frame N as PNG)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || join(root, 'out');
const pIdx = process.argv.indexOf('--preview');
const previewFrame = pIdx > -1 ? Number(process.argv[pIdx + 1]) : null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };

const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${port}/scene.html`);
await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
const total = await page.evaluate('window.FRAMES');
await mkdir(join(outDir, 'frames'), { recursive: true });

const frames = previewFrame !== null ? [previewFrame] : [...Array(total).keys()];
const t0 = Date.now();
for (const i of frames) {
  const url = await page.evaluate((n) => window.renderFrame(n), i);
  await writeFile(join(outDir, 'frames', `f${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  if (i % 24 === 0) console.log(`frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close(); server.close();
console.log(`done: ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
