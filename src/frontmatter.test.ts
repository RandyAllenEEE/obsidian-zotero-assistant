import type { App, TFile } from 'obsidian';

import {
  getFileCitekey,
  getFileFrontmatter,
  getFrontmatterString,
  isFirstImport,
  normalizeCitekey,
} from './frontmatter';

const file = { path: 'notes/paper.md' } as TFile;

function makeApp(frontmatter?: Record<string, unknown>, hasCache = true): App {
  return {
    metadataCache: {
      getFileCache: jest.fn(() => (hasCache ? ({ frontmatter } as any) : null)),
    },
  } as unknown as App;
}

describe('frontmatter access', () => {
  it('reads frontmatter through metadataCache', () => {
    const frontmatter = { citekey: 'smith2024paper' };

    expect(getFileFrontmatter(makeApp(frontmatter), file)).toEqual(frontmatter);
  });

  it('returns undefined when metadata cache is unavailable', () => {
    expect(getFileFrontmatter(makeApp(undefined, false), file)).toBeUndefined();
  });

  it('reads and trims string fields', () => {
    expect(
      getFrontmatterString(
        { zotero_pdf: '  file:///C:/paper.pdf  ' },
        'zotero_pdf'
      )
    ).toBe('file:///C:/paper.pdf');
    expect(
      getFrontmatterString({ zotero_pdf: 123 }, 'zotero_pdf')
    ).toBeUndefined();
  });
});

describe('citekey normalization', () => {
  it.each([
    ['smith2024paper', 'smith2024paper'],
    ['  smith2024paper  ', 'smith2024paper'],
    [' @smith2024paper ', 'smith2024paper'],
  ])('normalizes %p', (value, expected) => {
    expect(normalizeCitekey(value)).toBe(expected);
  });

  it.each([undefined, null, 123, '', '   ', '@  '])(
    'rejects invalid citekey %p',
    (value) => {
      expect(normalizeCitekey(value)).toBeUndefined();
    }
  );

  it('gets citekey from an actual metadata cache shape', () => {
    expect(
      getFileCitekey(makeApp({ citekey: '  @smith2024paper ' }), file)
    ).toBe('smith2024paper');
  });
});

describe('first import detection', () => {
  it('treats a missing file as a first import', () => {
    expect(isFirstImport(makeApp(), undefined)).toBe(true);
  });

  it('treats an existing file with latest_import_time as an update', () => {
    expect(
      isFirstImport(
        makeApp({ latest_import_time: '2026-07-15T21:16:55+08:00' }),
        file
      )
    ).toBe(false);
  });

  it('treats an existing file without latest_import_time as a first import', () => {
    expect(isFirstImport(makeApp({ citekey: 'smith2024paper' }), file)).toBe(
      true
    );
  });

  it('conservatively treats a cache miss on an existing file as an update', () => {
    expect(isFirstImport(makeApp(undefined, false), file)).toBe(false);
  });
});
