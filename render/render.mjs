// Renderiza la escena cuadro por cuadro en Chromium sin interfaz y la codifica con ffmpeg.
//   node render/render.mjs                    → salida/sismo_panama_2026.mp4 (con voz y subtítulos)
//   node render/render.mjs --stills 3,12,30   → capturas PNG en salida/capturas/
//   FPS=30 por defecto (variable de entorno FPS).
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT } from './serve.mjs';

const FPS = Number(process.env.FPS || 30);
const OUT = path.join(ROOT, 'salida');
const argStills = process.argv.indexOf('--stills');

const server = await serve();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.error('[página]', m.text()));
page.on('pageerror', (e) => console.error('[página]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/escena/index.html?render`);
await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 120000 });
const duration = await page.evaluate(() => window.DURATION);

async function frameAt(t, type = 'jpeg') {
  await page.evaluate((tt) => window.renderAt(tt), t);
  return page.screenshot({ type, quality: type === 'jpeg' ? 94 : undefined, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}

if (argStills > 0) {
  fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });
  for (const t of process.argv[argStills + 1].split(',').map(Number)) {
    fs.writeFileSync(path.join(OUT, 'capturas', `t${String(t).padStart(5, '0')}.png`), await frameAt(t, 'png'));
    console.log('captura', t);
  }
} else {
  const silent = path.join(OUT, 'tmp_video_mudo.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.ceil(duration * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frameAt(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok));
    if (i % 30 === 0) console.log(`cuadro ${i}/${n}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise((ok) => ff.on('close', ok));

  // Mezcla: voz + subtítulos quemados (también se entregan aparte en .srt)
  const final = path.join(OUT, 'sismo_panama_2026.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', path.join(OUT, 'narracion.wav'),
    '-vf', 'ass=salida/subtitulos.ass', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', '-movflags', '+faststart', final], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  fs.unlinkSync(silent);
  console.log('Listo:', final);
}
await browser.close();
server.close();
