/**
 * Keys out a uniform studio backdrop via edge-connected flood-fill so the
 * subject's interior dark hair/shadows stay intact while outer studio pixels
 * become smoothly transparent.
 */
export function keyBackdropToCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    const frame = ctx.getImageData(0, 0, w, h);
    const data = frame.data;

    // If image already has significant transparency (e.g. user uploaded transparent PNG), keep as-is
    let cornerAlphaSum = 0;
    const cornerIndices = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
    for (const idx of cornerIndices) cornerAlphaSum += data[idx + 3];
    if (cornerAlphaSum < 100) {
      return canvas;
    }

    const bgR = Math.round((data[0] + data[(w - 1) * 4]) / 2);
    const bgG = Math.round((data[1] + data[(w - 1) * 4 + 1]) / 2);
    const bgB = Math.round((data[2] + data[(w - 1) * 4 + 2]) / 2);

    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const colorDist = (idx: number): number => {
      const dr = data[idx] - bgR;
      const dg = data[idx + 1] - bgG;
      const db = data[idx + 2] - bgB;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    const seed = (x: number, y: number) => {
      const p = y * w + x;
      if (visited[p]) return;
      if (colorDist(p * 4) < 36) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) seed(x, 0);
    for (let y = 0; y < h; y++) {
      seed(0, y);
      seed(w - 1, y);
    }

    const hardThresh = 22;
    const softThresh = 42;

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      const idx = p * 4;
      const dist = colorDist(idx);

      if (dist <= hardThresh) {
        data[idx + 3] = 0;
      } else if (dist < softThresh) {
        const t = (dist - hardThresh) / (softThresh - hardThresh);
        data[idx + 3] = Math.round(t * 255);
      }

      if (dist < softThresh - 4) {
        if (x > 0) {
          const np = p - 1;
          if (!visited[np] && colorDist(np * 4) < softThresh) {
            visited[np] = 1;
            queue[tail++] = np;
          }
        }
        if (x < w - 1) {
          const np = p + 1;
          if (!visited[np] && colorDist(np * 4) < softThresh) {
            visited[np] = 1;
            queue[tail++] = np;
          }
        }
        if (y > 0) {
          const np = p - w;
          if (!visited[np] && colorDist(np * 4) < softThresh) {
            visited[np] = 1;
            queue[tail++] = np;
          }
        }
        if (y < h - 1) {
          const np = p + w;
          if (!visited[np] && colorDist(np * 4) < softThresh) {
            visited[np] = 1;
            queue[tail++] = np;
          }
        }
      }
    }

    ctx.putImageData(frame, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}
