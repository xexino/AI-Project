// BRAND END CARD (generic). The glowing dot becomes the i-dot of the wordmark; tagline + source lines.
// params: { wordmark_left, wordmark_dotless, wordmark_right, tagline, footer: [lines], colors: {bg, text, accent, footer} }
export async function build({ dur, params = {} }) {
  const P = Object.assign({ wordmark_left: 'oddl', wordmark_dotless: '\u0131', wordmark_right: 'ght', tagline: '', footer: [],
    colors: { bg: '#05141a', text: '#ede6d6', footer: '#7fd1c7' } }, params);
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  const load = async (fam, url) => { const f = new FontFace(fam, `url(${url})`); await f.load(); document.fonts.add(f); };
  await load('OLDisplay', '/engine/fonts/Fraunces-Regular.ttf'); await load('OLDisplayLight', '/engine/fonts/Fraunces-Light.ttf'); await load('OLCaption', '/engine/fonts/Inter-SemiBold.ttf');
  const cx = 540, cy = 960, size = 150;
  g.font = `${size}px OLDisplay`;
  const left = 'oddl', dotless = 'ı', right = 'ght';
  const wl = g.measureText(left).width, wi = g.measureText(dotless).width, wr = g.measureText(right).width;
  const xh = g.measureText('x').actualBoundingBoxAscent;
  const baseY = cy + xh + size * 0.13;                 // dot sits above the x-height
  const x0 = cx - wl - wi / 2;
  const ease = (a) => { a = Math.min(Math.max(a, 0), 1); return a * a * (3 - 2 * a); };
  const glow = (r, a) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    gr.addColorStop(0, `rgba(255,214,160,${a})`); gr.addColorStop(0.18, `rgba(255,160,70,${a})`); gr.addColorStop(0.32, `rgba(255,138,31,${0.55 * a})`); gr.addColorStop(1, 'rgba(255,138,31,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 3.2, 0, Math.PI * 2); g.fill(); };
  return { renderer: { domElement: cv }, render(t) {
    g.fillStyle = P.colors.bg; g.fillRect(0, 0, W, H);
    const word = ease((t - 0.25) / 0.8), tag = ease((t - 0.9) / 0.7), src = ease((t - 1.2) / 0.6), out = 1 - ease((t - (dur - 0.45)) / 0.45);
    glow(size * 0.11 * (1 + 0.04 * Math.sin(t * 3)), out);
    g.globalAlpha = word * out; g.fillStyle = P.colors.text; g.font = `${size}px OLDisplay`; g.textBaseline = 'alphabetic';
    g.fillText(left, x0, baseY); g.fillText(dotless, x0 + wl, baseY); g.fillText(right, x0 + wl + wi, baseY);
    g.globalAlpha = tag * out; g.font = `46px OLDisplayLight`; g.textAlign = 'center'; g.fillStyle = P.colors.text;
    g.fillText(P.tagline, cx, baseY + 120);
    g.globalAlpha = src * out * 0.7; g.font = `30px OLCaption`; g.fillStyle = P.colors.footer;
    P.footer.forEach((line, k) => g.fillText(line, cx, 1560 + k * 46));
    g.globalAlpha = 1; g.textAlign = 'left';
  } };
}
