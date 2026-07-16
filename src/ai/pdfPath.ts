import type { App, TFile } from 'obsidian';

import { fileUriToLocalPath } from '../fileLinks';
import { getFileFrontmatter, getFrontmatterString } from '../frontmatter';

type PdfPathApp = Pick<App, 'metadataCache'>;

export function extractLegacyPdfUri(fileContent: string): string | undefined {
  const match = fileContent.match(
    /^\s*-\s*\*\*full-text pdf\*\*:\s*(?:\[[^\]]*\])?\(<?(file:\/\/.*?)(?:>)?\)\s*$/im
  );

  const value = match?.[1]?.trim();
  return value || undefined;
}

export function getPdfUri(
  app: PdfPathApp,
  file: TFile,
  fileContent: string,
  preferredPdfUri?: string | null
): string | undefined {
  const preferred = preferredPdfUri?.trim();
  if (preferred) return preferred;

  const frontmatterUri = getFrontmatterString(
    getFileFrontmatter(app, file),
    'zotero_pdf'
  );
  if (frontmatterUri) return frontmatterUri;

  return extractLegacyPdfUri(fileContent);
}

export function resolvePdfPath(pdfUri: string): string | undefined {
  try {
    return fileUriToLocalPath(pdfUri);
  } catch {
    return undefined;
  }
}
