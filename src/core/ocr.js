const LIB_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';
let workerPromise;
let workerLanguage;

async function worker(language) {
  const requested = Array.isArray(language) ? language : String(language).split('+');
  const languageKey = requested.join('+');
  if (workerPromise && workerLanguage !== languageKey) {
    const previous = await workerPromise.catch(() => null);
    if (previous) await previous.terminate();
    workerPromise = null;
  }
  if (!workerPromise) {
    workerLanguage = languageKey;
    workerPromise = import(LIB_URL).then(async lib => lib.createWorker(requested, 1, { logger: () => {} })).catch(error => {
    workerPromise = null;
    throw new Error('Browser OCR could not be loaded. Check your internet connection, or enter the label text below.');
    });
  }
  return workerPromise;
}

async function prepare(file, rotation = 0) {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This browser cannot open this image format. Try JPG, PNG, or WebP, or type the label details manually.'); });
  const sideways = Math.abs(rotation % 180) === 90;
  const w = sideways ? bitmap.height : bitmap.width;
  const h = sideways ? bitmap.width : bitmap.height;
  const scale = Math.min(1.7, 2200 / Math.max(w, h));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
  ctx.filter = 'grayscale(1) contrast(1.22)';
  ctx.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale / 2, bitmap.width * scale, bitmap.height * scale);
  bitmap.close();
  return canvas;
}

export async function readPhoto(photo, language = 'eng', onProgress = () => {}) {
  const engine = await worker(language);
  const canvas = await prepare(photo.file, photo.rotation || 0);
  const result = await engine.recognize(canvas, {}, { text: true, blocks: true });
  onProgress(result.data);
  const words = (result.data.words || []).filter(word => word.text.trim());
  const uncertain = words.filter(word => word.confidence < 78).map(word => ({ text: word.text, confidence: Math.round(word.confidence) }));
  return { text: result.data.text || '', confidence: Math.round(result.data.confidence || 0), uncertain, type: photo.type, name: photo.file.name };
}

export async function terminateOcr() {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null); workerPromise = null;
  workerLanguage = null;
  if (w) await w.terminate();
}
