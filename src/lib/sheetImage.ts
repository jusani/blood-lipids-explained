// Clean-up of a lab sheet photo before reading (phase-v2 photo-reading-test/prep.py, in plain JS):
// grey, enlarged, background (shadows, uneven light) taken away, speckles removed, stretched to full
// contrast, then black text on white. Without this step the test read 12 of 96 values right.

/** Grey pixels in, black-and-white pixels out (0 = text, 255 = paper). Same size. */
export function cleanUp(grey: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const bg = blur(grey, w, h, 24);
  const diff = new Uint8ClampedArray(w * h);
  for (let i = 0; i < diff.length; i++) diff[i] = Math.max(0, bg[i] - grey[i]); // dark text on lighter paper
  const smooth = median3(diff, w, h);
  let lo = 255, hi = 0;
  for (const v of smooth) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(1, hi - lo);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) out[i] = ((smooth[i] - lo) * 255) / span > 60 ? 0 : 255;
  return out;
}

/** Three box blurs ≈ a Gaussian blur with sigma about 25 px, as in the test. */
function blur(src: Uint8ClampedArray, w: number, h: number, r: number): Float32Array {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    boxH(a, b, w, h, r);
    boxV(b, a, w, h, r);
  }
  return a;
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + clamp(x, w)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = sum / (2 * r + 1);
      sum += src[row + clamp(x + r + 1, w)] - src[row + clamp(x - r, w)];
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += src[clamp(y, h) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / (2 * r + 1);
      sum += src[clamp(y + r + 1, h) * w + x] - src[clamp(y - r, h) * w + x];
    }
  }
}

const clamp = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);

function median3(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const win = new Uint8Array(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win[k++] = src[clamp(y + dy, h) * w + clamp(x + dx, w)];
      win.sort();
      out[y * w + x] = win[4];
    }
  }
  return out;
}
