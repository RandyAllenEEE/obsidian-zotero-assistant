import type { App, TFile } from 'obsidian';

import { extractLegacyPdfUri, getPdfUri, resolvePdfPath } from './pdfPath';

const file = { path: 'notes/paper.md' } as TFile;

function makeApp(frontmatter?: Record<string, unknown>): App {
  return {
    metadataCache: {
      getFileCache: jest.fn(() => ({ frontmatter } as any)),
    },
  } as unknown as App;
}

describe('PDF URI resolution order', () => {
  it('prefers the URI supplied by the current import', () => {
    expect(
      getPdfUri(
        makeApp({ zotero_pdf: 'file:///C:/frontmatter.pdf' }),
        file,
        '- **full-text pdf**: [PDF](file:///C:/legacy.pdf)',
        ' file:///C:/current.pdf '
      )
    ).toBe('file:///C:/current.pdf');
  });

  it('reads zotero_pdf from metadata cache', () => {
    expect(
      getPdfUri(
        makeApp({ zotero_pdf: ' file:///C:/frontmatter.pdf ' }),
        file,
        ''
      )
    ).toBe('file:///C:/frontmatter.pdf');
  });

  it('falls back to legacy body links', () => {
    expect(
      getPdfUri(
        makeApp(),
        file,
        '- **full-text pdf**: [PDF](file:///C:/Paper%20(final).pdf)'
      )
    ).toBe('file:///C:/Paper%20(final).pdf');
  });

  it('returns undefined when no PDF source is available', () => {
    expect(getPdfUri(makeApp(), file, 'No PDF link')).toBeUndefined();
  });
});

describe('legacy PDF link parsing', () => {
  it('accepts angle-bracket destinations', () => {
    expect(
      extractLegacyPdfUri(
        '- **full-text pdf**: [PDF](<file:///C:/Paper%20(final).pdf>)'
      )
    ).toBe('file:///C:/Paper%20(final).pdf');
  });

  it('ignores unrelated links', () => {
    expect(extractLegacyPdfUri('[PDF](file:///C:/paper.pdf)')).toBeUndefined();
  });
});

describe('PDF local path resolution', () => {
  it('resolves standard URIs', () => {
    expect(resolvePdfPath('file:///C:/Papers/My%20Paper.pdf')).toBe(
      'C:\\Papers\\My Paper.pdf'
    );
  });

  it('resolves legacy URIs', () => {
    expect(resolvePdfPath('file://C:\\Papers\\My%20Paper.pdf')).toBe(
      'C:\\Papers\\My Paper.pdf'
    );
  });

  it('returns undefined for invalid URIs', () => {
    expect(resolvePdfPath('file://%')).toBeUndefined();
  });
});
