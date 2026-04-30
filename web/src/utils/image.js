/**
 * Downscale an image File to a square max-side, reject if too small.
 * Uses an OffscreenCanvas if available; falls back to <canvas>.
 *
 * Returns a NEW File with the chosen mime type.
 */
export async function resizeImageFile(file, opts = {}) {
  const maxSide = opts.maxSide || 512;
  const minSide = opts.minSide || 64;
  const quality = opts.quality ?? 0.9;
  const type    = opts.type    || (file.type.includes('png') ? 'image/png' : 'image/jpeg');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload  = () => res(i);
      i.onerror = (e) => rej(new Error('Не удалось прочитать изображение'));
      i.src = url;
    });
    if (img.width < minSide || img.height < minSide) {
      throw new Error(`Минимум ${minSide}×${minSide} пикселей`);
    }

    let { width: w, height: h } = img;
    const longest = Math.max(w, h);
    if (longest > maxSide) {
      const k = maxSide / longest;
      w = Math.round(w * k);
      h = Math.round(h * k);
    }
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await (canvas.convertToBlob
      ? canvas.convertToBlob({ type, quality })
      : new Promise((r) => canvas.toBlob(r, type, quality)));
    if (!blob) throw new Error('Не удалось закодировать');
    const ext = type === 'image/png' ? '.png' : '.jpg';
    return new File([blob], (file.name || 'avatar').replace(/\.\w+$/, '') + ext, { type });
  } finally {
    URL.revokeObjectURL(url);
  }
}
