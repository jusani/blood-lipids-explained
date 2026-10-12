// Reads a lab sheet photo or PDF on this device (v2 prototype, behind the photoReading flag).
// The reader and its Lithuanian + English language files are self-hosted under ./ocr/ and are only
// downloaded when the person picks a file; the service worker then keeps them for offline use.
// Nothing is sent anywhere and the file itself is not kept.

import { cleanUp } from './sheetImage';
import { itemsToLines, parseLabText, type SheetValues } from './readSheet';

const OCR_DIR = () => new URL('./ocr/', document.baseURI).href;
/** Longest side of the cleaned image: enough for small print, small enough to stay quick. */
const MAX_SIDE = 2400;

export async function readSheetFile(file: File, onProgress?: (p: number) => void): Promise<SheetValues> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return readPdf(file, onProgress);
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return readCanvas(drawScaled(bitmap, bitmap.width, bitmap.height), onProgress);
}

/** A PDF from the lab: its own text first (close to exact); a scanned PDF is read like a photo. */
async function readPdf(file: File, onProgress?: (p: number) => void): Promise<SheetValues> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = OCR_DIR() + 'pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true });
  const doc = await task.promise;
  try {
    const lines: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.flatMap((i) => ('str' in i ? [{ x: i.transform[4], y: i.transform[5], text: i.str }] : []));
      lines.push(...itemsToLines(items));
    }
    const found = parseLabText(lines.join('\n'));
    if (Object.keys(found).length > 0) return found;
    // No text layer: draw the first page and read it like a photo.
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return readCanvas(drawScaled(canvas, canvas.width, canvas.height), onProgress);
  } finally {
    await task.destroy();
  }
}

/** Grey copy at twice the size (as in the test), but never above MAX_SIDE. */
function drawScaled(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(2, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function readCanvas(canvas: HTMLCanvasElement, onProgress?: (p: number) => void): Promise<SheetValues> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grey = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < grey.length; i++) grey[i] = (img.data[i * 4] * 299 + img.data[i * 4 + 1] * 587 + img.data[i * 4 + 2] * 114) / 1000;
  const bw = cleanUp(grey, canvas.width, canvas.height);
  for (let i = 0; i < bw.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = bw[i];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const { createWorker } = await import('tesseract.js');
  const dir = OCR_DIR();
  const worker = await createWorker(['lit', 'eng'], 1 /* LSTM only */, {
    workerPath: dir + 'worker.min.js',
    corePath: dir,
    langPath: dir,
    workerBlobURL: false,   // a blob worker would need a looser Content Security Policy
    gzip: true,
    cacheMethod: 'none',    // the service worker keeps the files; no second copy in IndexedDB
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return parseLabText(data.text);
  } finally {
    await worker.terminate();
  }
}
