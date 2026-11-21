import { Notice, request, requestUrl } from 'obsidian';

import { getCurrentWindow } from '../helpers';
import { CitationFormat, DatabaseWithPort } from '../types';
import {
  formatCitationMarkdownLink,
  getCitationLinkFallbackNotice,
  getCitationLinkType,
  getZoteroMetadataPath,
  parseCaywCitationResponse,
  resolveCitationLinkTarget,
} from './citationLinks';
import { LoadingModal } from './LoadingModal';
import { defaultHeaders, getPort } from './helpers';
import { getBibFromCiteKeys } from './jsonRPC';
import { ZQueue } from './queue';

export function getCiteKeyFromAny(item: any): CiteKey | null {
  if (!item.citekey && !item.citationKey) return null;

  return {
    key: item.citekey || item.citationKey,
    library: item.libraryID,
  };
}

async function requestWithBlur(
  url: string,
  jsonBody?: { format: 'formatted-citation'; style?: string }
) {
  const win = getCurrentWindow();
  win?.blur();
  try {
    return await request({
      method: jsonBody ? 'POST' : 'GET',
      url,
      headers: defaultHeaders,
      ...(jsonBody
        ? { contentType: 'application/json', body: JSON.stringify(jsonBody) }
        : {}),
    });
  } finally {
    win?.show();
  }
}

let cachedIsRunning = false;
let lastCheck = 0;

export async function isZoteroRunning(
  database: DatabaseWithPort,
  silent?: boolean
) {
  if (cachedIsRunning && Date.now() - lastCheck < 1000 * 30) {
    return cachedIsRunning;
  }

  let modal: LoadingModal;
  if (!silent) {
    modal = new LoadingModal(app, 'Fetching data from Zotero...');
    modal.open();
  }
  const qid = Symbol();
  try {
    await ZQueue.wait(qid);
    const res = await request({
      method: 'GET',
      url: `http://127.0.0.1:${getPort(
        database.database,
        database.port
      )}/better-bibtex/cayw?probe=true`,
      headers: defaultHeaders,
    });

    modal?.close();
    cachedIsRunning = res === 'ready';
    lastCheck = Date.now();
    ZQueue.end(qid);
    return cachedIsRunning;
  } catch (e) {
    modal?.close();
    !silent &&
      new Notice(
        'Cannot connect to Zotero. Please ensure it is running and the Better BibTeX plugin is installed',
        10000
      );
    ZQueue.end(qid);
    return false;
  }
}

function getQueryParams(format: CitationFormat) {
  switch (format.format) {
    case 'formatted-bibliography':
      return 'format=formatted-bibliography';
    case 'formatted-citation':
      return `format=formatted-citation${format.cslStyle ? `&style=${format.cslStyle}` : ''
        }`;
    case 'pandoc':
      return `format=pandoc${format.brackets ? '&brackets=true' : ''}`;
    case 'latex':
      return `format=latex&command=${format.command || 'cite'}`;
    case 'biblatex':
      return `format=biblatex&command=${format.command || 'autocite'}`;
  }
}

export async function getCAYW(
  format: CitationFormat,
  database: DatabaseWithPort
) {
  const win = getCurrentWindow();
  if (!(await isZoteroRunning(database))) {
    return null;
  }

  const modal = new LoadingModal(app, 'Awaiting item selection from Zotero...');
  modal.open();

  const qid = Symbol();
  try {
    const citationLinkType = getCitationLinkType(format);

    if (format.format === 'formatted-bibliography') {
      modal.close();
      const citeKeys = await getCiteKeys(database);
      return await getBibFromCiteKeys(citeKeys, database, format.cslStyle);
    }

    if (format.format === 'formatted-citation' && citationLinkType !== 'none') {
      await ZQueue.wait(qid);

      const endpoint = `http://127.0.0.1:${getPort(database.database, database.port)}/better-bibtex/cayw`;
      const probe = await requestUrl({
        method: 'POST',
        url: `${endpoint}?probe=true`,
        headers: defaultHeaders,
        contentType: 'application/json',
        body: '{}',
        throw: false,
      });
      if (probe.status === 400 && probe.text.trim() === 'Endpoint does not support method') {
        new Notice('This Better BibTeX version cannot add citation links. Inserting a plain citation; update Better BibTeX to enable links.', 10000);
        const params = new URLSearchParams({ format: 'formatted-citation' });
        if (format.cslStyle) params.set('style', format.cslStyle);
        const citation = await requestWithBlur(`${endpoint}?${params.toString()}`);
        modal.close();
        ZQueue.end(qid);
        return citation || null;
      }
      if (probe.status !== 200 || probe.text.trim() !== 'ready') {
        throw new Error('Cannot verify Better BibTeX citation support.');
      }

      // Better BibTeX returns the rendered citation and its picked items in
      // one response. Selecting those items in the Zotero library would
      // switch away from the current reader and discard picker locators.
      const raw = await requestWithBlur(
        endpoint,
        { format: 'formatted-citation', style: format.cslStyle || undefined }
      );
      const { output: citationRes, items } = parseCaywCitationResponse(raw);
      modal.close();
      ZQueue.end(qid);

      if (citationRes) {
        let linkResolution = resolveCitationLinkTarget(items, citationLinkType);
        if (
          !linkResolution.target &&
          items.length === 1 &&
          (citationLinkType === 'url' || citationLinkType === 'doi')
        ) {
          const itemPath = getZoteroMetadataPath(items[0]);
          if (itemPath) {
            try {
              const item = JSON.parse(await request({
                method: 'GET',
                url: `http://127.0.0.1:${getPort(database.database, database.port)}${itemPath}`,
                headers: { 'Zotero-API-Version': '3' },
              }));
              linkResolution = resolveCitationLinkTarget([item], citationLinkType);
            } catch {
              // If the local API is unavailable, keep the formatted citation.
            }
          }
        }

        if (linkResolution.target) {
          return formatCitationMarkdownLink(citationRes, linkResolution.target);
        }

        const notice = getCitationLinkFallbackNotice(linkResolution);
        if (notice) {
          new Notice(notice, 7000);
        }

        return citationRes;
      }
      return null;
    }

    await ZQueue.wait(qid);

    // Legacy/Original Path: Ensure parameters are properly encoded
    const params = new URLSearchParams();

    switch (format.format) {
      case 'formatted-citation':
        params.append('format', 'formatted-citation');
        if (format.cslStyle) {
          params.append('style', format.cslStyle);
        }
        break;
      case 'pandoc':
        params.append('format', 'pandoc');
        if (format.brackets) {
          params.append('brackets', 'true');
        }
        break;
      case 'latex':
        params.append('format', 'latex');
        params.append('command', format.command || 'cite');
        break;
      case 'biblatex':
        params.append('format', 'biblatex');
        params.append('command', format.command || 'autocite');
        break;
    }

    const res = await requestWithBlur(`http://127.0.0.1:${getPort(
      database.database,
      database.port
    )}/better-bibtex/cayw?${params.toString()}`);

    win.show();
    modal.close();
    ZQueue.end(qid);
    return res;
  } catch (e) {
    win.show();
    console.error(e);
    modal.close();
    new Notice(`Error processing citation: ${e.message}`, 10000);
    ZQueue.end(qid);
    return null;
  }
}

export interface CiteKey {
  key: string;
  library: number;
}

export async function getCiteKeys(
  database: DatabaseWithPort
): Promise<CiteKey[]> {
  try {
    const json = await getCAYWJSON(database);

    if (!json) return [];

    const citeKeys = json
      .map((e: any) => {
        return getCiteKeyFromAny(e);
      })
      .filter((e: any) => !!e);

    if (!citeKeys.length) {
      return [];
    }

    return citeKeys;
  } catch (e) {
    return [];
  }
}

export async function getCAYWJSON(database: DatabaseWithPort) {
  const win = getCurrentWindow();
  if (!(await isZoteroRunning(database))) {
    return null;
  }

  const modal = new LoadingModal(app, 'Awaiting item selection from Zotero...');
  modal.open();

  const qid = Symbol();
  try {
    await ZQueue.wait(qid);
    const res = await requestWithBlur(`http://127.0.0.1:${getPort(
      database.database,
      database.port
    )}/better-bibtex/cayw?format=translate&translator=36a3b0b5-bad0-4a04-b79b-441c7cef77db&exportNotes=false`);

    win.show();

    modal.close();
    ZQueue.end(qid);
    if (res) {
      return JSON.parse(res).items || [];
    } else {
      return null;
    }
  } catch (e) {
    win.show();
    console.error(e);
    modal.close();
    new Notice(`Error retrieving cite key: ${e.message}`, 10000);
    ZQueue.end(qid);
    return null;
  }
}
