import type { ExportFormat, ZoteroConnectorSettings } from './types';
import { resolveUpdateLibraryNoteFormat } from './updateLibraryNote';

function format(name: string): ExportFormat {
  return {
    name,
    outputPathTemplate: '{{citekey}}.md',
    imageOutputPathTemplate: 'assets/',
    imageBaseNameTemplate: 'image',
  };
}

function settings(
  values: Partial<ZoteroConnectorSettings> = {}
): ZoteroConnectorSettings {
  return {
    citeFormats: [],
    database: 'Zotero',
    exportFormats: [],
    noteImportFolder: '',
    openNoteAfterImport: false,
    whichNotesToOpenAfterImport: 'first-imported-note',
    ...values,
  };
}

describe('resolveUpdateLibraryNoteFormat', () => {
  it('prefers the explicit update format', () => {
    const explicit = format('Update');
    const custom = format('Custom');

    expect(
      resolveUpdateLibraryNoteFormat(
        settings({
          updateLibraryNoteFormat: explicit,
          exportFormats: [custom],
          importHereFormat: format('Import Here'),
        })
      )
    ).toBe(explicit);
  });

  it('falls back to the first custom import format', () => {
    const first = format('First');

    expect(
      resolveUpdateLibraryNoteFormat(
        settings({
          exportFormats: [first, format('Second')],
          importHereFormat: format('Import Here'),
        })
      )
    ).toBe(first);
  });

  it('falls back to Import Here when there are no custom formats', () => {
    const importHere = format('Import Here');

    expect(
      resolveUpdateLibraryNoteFormat(settings({ importHereFormat: importHere }))
    ).toBe(importHere);
  });

  it('returns undefined when no usable format exists', () => {
    expect(resolveUpdateLibraryNoteFormat(settings())).toBeUndefined();
  });
});
