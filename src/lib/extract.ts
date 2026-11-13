import type { PlanDocument } from './plan';
export const MAX_FILES = 6;
export const MAX_BYTES = 10 * 1024 * 1024;
export function validateFile(file: File): string | null {
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) return `${file.name}: choose a PDF, PNG, or JPG.`;
  if (file.size > MAX_BYTES) return `${file.name}: the limit is 10 MB per file.`;
  if (!file.size) return `${file.name}: this file is empty.`;
  return null;
}
export async function extractDocument(file: File, kind: PlanDocument['kind'], progress: (message: string) => void): Promise<PlanDocument> {
  const doc: PlanDocument = { id: crypto.randomUUID(), name: file.name, mime: file.type, size: file.size, blob: file, kind, text: '', status: 'needs-review' };
  try {
    if (file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 100) throw new Error('Please split this document into files of 100 pages or fewer.');
        let emptyPages = 0;
        for (let i = 1; i <= pdf.numPages; i++) {
          progress(`Reading ${file.name} · page ${i} of ${pdf.numPages}`);
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
          if (!text.trim()) emptyPages++;
          doc.text += `\n[Page ${i}]\n${text}`;
          page.cleanup();
        }
        if (emptyPages) doc.message = `${emptyPages} page(s) have no readable text. Scanned PDFs need OCR; upload card images or enter details manually.`;
      } finally { await task.destroy(); }
    } else {
      const { createWorker } = await import('tesseract.js');
      progress(`Reading ${file.name} · loading English OCR`);
      const worker = await createWorker('eng', 1, { logger: m => { if (m.status === 'recognizing text') progress(`Reading ${file.name} · ${Math.round(m.progress * 100)}%`); } });
      try { doc.text = (await worker.recognize(file)).data.text; } finally { await worker.terminate(); }
    }
    if (!doc.text.trim()) doc.message = 'No text could be read. You can still enter your details manually.';
    doc.status = doc.message ? 'needs-review' : 'ready';
  } catch (error) {
    doc.message = error instanceof Error && error.message.includes('100 pages') ? error.message : 'Text extraction failed. Try an unlocked PDF or a clearer image, or enter details manually.';
  }
  return doc;
}
