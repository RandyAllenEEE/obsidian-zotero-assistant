import type { CitationFormat, CitationLinkType } from '../types';
import { getLocalURI } from './helpers';

export type CitationLinkFallbackReason = 'multi-select' | 'missing-target';

export interface CitationLinkResolution {
  linkType: CitationLinkType;
  target?: string;
  reason?: CitationLinkFallbackReason;
}

const citationLinkTypes: CitationLinkType[] = [
  'none',
  'zotero-item',
  'url',
  'doi',
];

export function getCitationLinkType(
  format: Pick<CitationFormat, 'citationLinkType' | 'addZoteroLink'>
): CitationLinkType {
  if (
    format.citationLinkType &&
    citationLinkTypes.includes(format.citationLinkType)
  ) {
    return format.citationLinkType;
  }

  return format.addZoteroLink ? 'zotero-item' : 'none';
}

function getCandidateObjects(item: any) {
  return [
    item,
    item?.item,
    item?.item?.item,
    item?.item?.data,
    item?.data,
    item?.itemData,
    item?.citationItem,
    item?.csl,
  ].filter((candidate) => candidate && typeof candidate === 'object');
}

function findStringField(item: any, fields: string[]) {
  for (const candidate of getCandidateObjects(item)) {
    for (const field of fields) {
      const value = candidate[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

function toZoteroSelectURI(value: string) {
  if (value.startsWith('zotero://select/')) {
    return value;
  }

  if (/^https?:\/\/zotero\.org\//.test(value)) {
    return getLocalURI('select', value.replace(/^https:/, 'http:'));
  }

  return null;
}

export function getZoteroItemLink(item: any) {
  const existingLink = findStringField(item, ['select', 'desktopURI']);
  if (existingLink) {
    const selectURI = toZoteroSelectURI(existingLink);
    if (selectURI) return selectURI;
  }

  const uri = findStringField(item, ['uri']);
  const pickedUris: unknown[] = Array.isArray(item?.uris) ? item.uris : [];
  for (const candidate of [uri, ...pickedUris]) {
    if (typeof candidate === 'string') {
      const selectURI = toZoteroSelectURI(candidate);
      if (selectURI) return selectURI;
    }
  }

  const itemKey = findStringField(item, ['itemKey']);
  if (itemKey) {
    return `zotero://select/library/items/${itemKey}`;
  }

  return null;
}

// Use only canonical item links as a source of identifiers. The HTTP origin
// is supplied separately by the caller and is always local.
export function getZoteroMetadataPath(item: any): string | null {
  const link = getZoteroItemLink(item);
  const match = link?.match(
    /^zotero:\/\/select\/(?:library|groups\/(\d+))\/items\/([A-Z0-9]{8})$/
  );
  if (!match) return null;
  const [, groupId, itemKey] = match;
  return groupId
    ? `/api/groups/${groupId}/items/${itemKey}`
    : `/api/users/0/items/${itemKey}`;
}

export function getUrlLink(item: any) {
  return findStringField(item, ['url', 'URL']);
}

export function normalizeDoiLink(value: string) {
  const doi = value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();

  if (!doi) return null;

  return `https://doi.org/${doi}`;
}

export function getDoiLink(item: any) {
  const doi = findStringField(item, ['DOI', 'doi']);
  return doi ? normalizeDoiLink(doi) : null;
}

export function resolveCitationLinkTarget(
  items: any[],
  linkType: CitationLinkType
): CitationLinkResolution {
  if (linkType === 'none') {
    return { linkType };
  }

  if (items.length > 1) {
    return { linkType, reason: 'multi-select' };
  }

  const item = items[0];
  if (!item) {
    return { linkType, reason: 'missing-target' };
  }

  const target =
    linkType === 'zotero-item'
      ? getZoteroItemLink(item)
      : linkType === 'url'
        ? getUrlLink(item)
        : getDoiLink(item);

  if (!target) {
    return { linkType, reason: 'missing-target' };
  }

  return { linkType, target };
}

function escapeMarkdownLinkText(text: string) {
  return text.replace(/\]/g, '\\]');
}

function formatMarkdownLinkTarget(target: string) {
  const escapedTarget = target.replace(/</g, '%3C').replace(/>/g, '%3E');

  if (/[\s()]/.test(escapedTarget)) {
    return `<${escapedTarget}>`;
  }

  return escapedTarget;
}

export function formatCitationMarkdownLink(text: string, target: string) {
  return `[${escapeMarkdownLinkText(text)}](${formatMarkdownLinkTarget(
    target
  )})`;
}

export function parseCaywCitationResponse(response: string): {
  output: string;
  items: any[];
} {
  const parsed = JSON.parse(response);
  if (typeof parsed?.output !== 'string' || !Array.isArray(parsed.pick)) {
    throw new Error('Better BibTeX did not return a structured citation response.');
  }
  const items = parsed.pick.flatMap((pick: any) =>
    Array.isArray(pick?.citationItems)
      ? pick.citationItems.filter((item: any) => item && item.itemData?.type !== 'note')
      : []
  );
  return { output: parsed.output, items };
}

export function getCitationLinkFallbackNotice(
  resolution: CitationLinkResolution
) {
  if (resolution.reason === 'multi-select') {
    return 'Multiple Zotero items selected; citation inserted without a link.';
  }

  if (resolution.reason === 'missing-target') {
    const linkTypeLabel =
      resolution.linkType === 'zotero-item'
        ? 'Zotero item link'
        : resolution.linkType === 'url'
          ? 'URL'
          : 'DOI';

    return `No ${linkTypeLabel} found for the selected Zotero item; citation inserted without a link.`;
  }

  return null;
}
