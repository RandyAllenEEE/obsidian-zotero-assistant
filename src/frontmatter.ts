import type { App, TFile } from 'obsidian';

export type FileFrontmatter = Record<string, unknown>;

type FrontmatterApp = Pick<App, 'metadataCache'>;

export function getFileFrontmatter(
  app: FrontmatterApp,
  file: TFile
): FileFrontmatter | undefined {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

  if (!frontmatter || typeof frontmatter !== 'object') return undefined;

  return frontmatter as FileFrontmatter;
}

export function getFrontmatterString(
  frontmatter: FileFrontmatter | undefined,
  key: string
): string | undefined {
  const value = frontmatter?.[key];
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeCitekey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const citekey = trimmed.startsWith('@')
    ? trimmed.substring(1).trim()
    : trimmed;

  return citekey || undefined;
}

export function getFileCitekey(
  app: FrontmatterApp,
  file: TFile
): string | undefined {
  return normalizeCitekey(getFileFrontmatter(app, file)?.citekey);
}

export function isFirstImport(
  app: FrontmatterApp,
  existingFile: TFile | null | undefined
): boolean {
  if (!existingFile) return true;

  const frontmatter = getFileFrontmatter(app, existingFile);
  if (!frontmatter) return false;

  const latestImportTime = frontmatter.latest_import_time;
  if (typeof latestImportTime === 'string') {
    return latestImportTime.trim().length === 0;
  }

  return latestImportTime === null || latestImportTime === undefined;
}
