import type { ExportFormat, ZoteroConnectorSettings } from './types';

export function resolveUpdateLibraryNoteFormat(
  settings: ZoteroConnectorSettings
): ExportFormat | undefined {
  return (
    settings.updateLibraryNoteFormat ||
    settings.exportFormats[0] ||
    settings.importHereFormat
  );
}
