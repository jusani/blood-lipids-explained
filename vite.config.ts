import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Photo/PDF reading is on in the live build (Justina, 2026-10-12, testing mode). VITE_PHOTO_READING=0
// builds without it (no reader files, stub module), e.g. to roll back quickly.
const PHOTO = process.env.VITE_PHOTO_READING !== '0';
const require = createRequire(import.meta.url);

// Strict Content Security Policy for the built app (architect A9): nothing loads
// from anywhere but the app's own files, and the app cannot send data anywhere.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// Photo/PDF reading prototype (photo build only): the reader, its cores and the lit + eng
// language files are served from ./ocr/ next to the app, so nothing loads from another server.
const OCR_FILES: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'lit.traineddata.gz': '@tesseract.js-data/lit/4.0.0_best_int/lit.traineddata.gz',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs',
};

function ocrFiles(): Plugin {
  return {
    name: 'ocr-files',
    enforce: 'pre',
    apply: 'build',
    // Live build: the reader module is swapped for an empty stub, so neither the reader nor the
    // PDF library ends up in dist/ (the flag also removes the button).
    resolveId(id) {
      if (!PHOTO && id.endsWith('lib/sheetReader')) return '\0sheet-reader-off';
      return null;
    },
    load(id) {
      if (id === '\0sheet-reader-off') return "export async function readSheetFile() { throw new Error('photo reading is off in this build'); }";
      return null;
    },
    generateBundle() {
      if (!PHOTO) return;
      for (const [name, from] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(require.resolve(from)) });
      }
    },
  };
}

function isStaticallyImported(bundle: Record<string, { type: string; imports?: string[] }>, file: string): boolean {
  return Object.values(bundle).some((c) => c.type === 'chunk' && c.imports!.includes(file));
}

// Offline support: a service worker that precaches every built file.
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // .woff fallbacks are skipped: every browser that runs service workers reads .woff2.
      // ocr/ (photo build only, about 13 MB) is not precached: it is fetched when someone reads a
      // sheet, then kept by the fetch handler below.
      // Code loaded only on demand (the reader chunks) is left out too, the same way.
      const lazy = new Set(Object.values(bundle).filter((c) => c.type === 'chunk' && !c.isEntry && !isStaticallyImported(bundle, c.fileName)).map((c) => c.fileName));
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff') && !f.startsWith('ocr/') && !lazy.has(f));
      files.push('manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png');
      const assets = ['./', ...files.map((f) => './' + f)];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      // The reader files get their own cache, named by their content, so a release that does not
      // change them does not download the 9 MB again (whole-app test U3).
      const ocrHash = createHash('sha256');
      for (const f of Object.keys(bundle).filter((f) => f.startsWith('ocr/')).sort()) {
        const a = bundle[f] as { source?: string | Uint8Array };
        ocrHash.update(f).update(a.source ?? '');
      }
      const ocrVersion = ocrHash.digest('hex').slice(0, 12);
      const source = `// Generated at build time. Precaches the app so it works offline.
const CACHE = 'app-${version}';
const OCR_CACHE = 'ocr-${ocrVersion}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a release never stores the previous
  // start page (GitHub Pages sends max-age=600; whole-app test U1).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
    return;
  }
  const path = new URL(req.url).pathname;
  if (path.includes('/ocr/') || path.includes('/assets/')) {
    const keep = path.includes('/ocr/') ? OCR_CACHE : CACHE;
    e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(keep).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __PHOTO_READING__: JSON.stringify(PHOTO) },
  plugins: [preact(), csp(), ocrFiles(), serviceWorker()],
  build: { target: 'es2019', sourcemap: false, assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'] },
});
