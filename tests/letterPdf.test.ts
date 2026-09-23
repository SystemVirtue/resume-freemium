import { describe, expect, it } from 'vitest';
import { A4_HEIGHT_MM, A4_WIDTH_MM, buildLetterPdf } from '@/lib/letterPdf';

const para = (id: string, text: string) => ({ id, text, locked: false });

describe('letter PDF export', () => {
  it('lays a short letter out on one A4 page', async () => {
    const doc = await buildLetterPdf({
      title: 'Cover letter',
      paragraphs: [
        para('a', 'Dear Ms Okafor,'),
        para('b', 'I am applying for the role of Senior Backend Engineer.'),
        para('c', 'I would welcome the chance to talk it through.'),
      ],
    });

    expect(doc.getNumberOfPages()).toBe(1);
    const size = doc.internal.pageSize;
    expect(Math.round(size.getWidth())).toBe(A4_WIDTH_MM);
    expect(Math.round(size.getHeight())).toBe(A4_HEIGHT_MM);
  });

  it('shrinks the body before it spills onto a second page', async () => {
    const doc = await buildLetterPdf({
      title: 'Cover letter',
      paragraphs: [para('a', 'Sentence about the work. '.repeat(120))],
    });
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('adds a page rather than dropping text', async () => {
    const doc = await buildLetterPdf({
      title: 'Cover letter',
      paragraphs: Array.from({ length: 6 }, (_, i) =>
        para(String(i), 'A paragraph that runs on for a while. '.repeat(200)),
      ),
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('writes real text, not a picture of a page', async () => {
    // Uncompressed so the content stream can be read back as plain characters.
    const doc = await buildLetterPdf({
      title: 'Cover letter',
      compress: false,
      header: 'Priya Raman — priya.raman@example.com',
      paragraphs: [
        para('a', 'Dear hiring manager,'),
        para('b', 'I designed the reconciliation service at Ledgerly.'),
      ],
    });

    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    // Text-showing operators carry the actual characters, so extraction is clean.
    expect(raw).toContain('Tj');
    expect(raw).toContain('I designed the reconciliation service at Ledgerly.');
  });

  it('opens as a valid PDF by default', async () => {
    const doc = await buildLetterPdf({
      title: 'Cover letter',
      paragraphs: [para('a', 'Dear hiring manager,')],
    });
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw).toContain('%%EOF');
  });
});
