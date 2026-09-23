import { Paragraph, lettersToText } from './coverLetter';

export interface LetterPdfOptions {
  /** Used for the document title and the file name. */
  title: string;
  paragraphs: Paragraph[];
  /** Optional line printed above the letter, e.g. the candidate's name and contact. */
  header?: string;
  /** Stream compression. On by default; turned off by tests that read the raw text. */
  compress?: boolean;
}

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const LETTER_MARGIN_MM = 20;

/** Body sizes tried largest first, so the letter fits one page when it can. */
const FONT_STEPS: { size: number; leading: number }[] = [
  { size: 11, leading: 5.2 },
  { size: 10.5, leading: 5 },
  { size: 10, leading: 4.8 },
  { size: 9.5, leading: 4.6 },
];

const slug = (s: string) =>
  s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'cover-letter';

/**
 * Lay the letter out on A4 with sensible margins as real vector text, so the PDF
 * has selectable, cleanly extractable text rather than a picture of a page. The
 * body shrinks through a few sizes before it is allowed to spill onto a second page.
 */
export async function buildLetterPdf({ title, paragraphs, header, compress = true }: LetterPdfOptions) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress });

  const contentWidth = A4_WIDTH_MM - LETTER_MARGIN_MM * 2;
  const bodyParagraphs = paragraphs.map((p) => p.text.trim()).filter(Boolean);
  const headerBlock = (header || '').trim();

  let chosen = FONT_STEPS[FONT_STEPS.length - 1];
  for (const step of FONT_STEPS) {
    doc.setFont('times', 'normal');
    doc.setFontSize(step.size);
    const headerLines = headerBlock
      ? doc.splitTextToSize(headerBlock, contentWidth).length + 1
      : 0;
    const bodyLines = bodyParagraphs.reduce(
      (n, p) => n + doc.splitTextToSize(p, contentWidth).length + 1,
      0,
    );
    const available = Math.floor((A4_HEIGHT_MM - LETTER_MARGIN_MM * 2) / step.leading);
    if (headerLines + bodyLines <= available) {
      chosen = step;
      break;
    }
  }

  doc.setFontSize(chosen.size);
  let y = LETTER_MARGIN_MM;

  if (headerBlock) {
    doc.setFont('times', 'bold');
    doc.text(doc.splitTextToSize(headerBlock, contentWidth), LETTER_MARGIN_MM, y);
    y += doc.splitTextToSize(headerBlock, contentWidth).length * chosen.leading + chosen.leading;
  }

  doc.setFont('times', 'normal');
  bodyParagraphs.forEach((text, i) => {
    const lines: string[] = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      if (y + chosen.leading > A4_HEIGHT_MM - LETTER_MARGIN_MM) {
        doc.addPage();
        y = LETTER_MARGIN_MM;
      }
      doc.text(line, LETTER_MARGIN_MM, y);
      y += chosen.leading;
    });
    // A blank half-line between paragraphs, except after the last one.
    if (i < bodyParagraphs.length - 1) y += chosen.leading * 0.5;
  });

  doc.setProperties({ title });
  return doc;
}

/** Build the A4 letter and hand it to the browser as a download. */
export async function downloadLetterPdf(options: LetterPdfOptions): Promise<void> {
  const doc = await buildLetterPdf(options);
  doc.save(`${slug(options.title)}.pdf`);
}

export const letterPlainText = lettersToText;
