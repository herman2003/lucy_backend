import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/features/documents/fixtures/sample.pdf');

const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello PDF', { x: 100, y: 700, size: 12, font });
const bytes = await pdfDoc.save();
writeFileSync(outPath, bytes);
console.log(`Wrote ${outPath} (${bytes.length} bytes)`);
