import { getCAYW } from '../cayw';
import { Notice, request, requestUrl } from 'obsidian';

jest.mock('obsidian', () => ({
  Notice: jest.fn(),
  request: jest.fn(),
  requestUrl: jest.fn(),
}), { virtual: true });
jest.mock('../../helpers', () => ({
  getCurrentWindow: () => ({ blur: jest.fn(), show: jest.fn() }),
}));
jest.mock('../jsonRPC', () => ({ getBibFromCiteKeys: jest.fn() }));
jest.mock('../LoadingModal', () => ({
  LoadingModal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    close: jest.fn(),
  })),
}));
jest.mock('../queue', () => ({
  ZQueue: { wait: jest.fn().mockResolvedValue(undefined), end: jest.fn() },
}));

beforeEach(() => {
  jest.mocked(requestUrl).mockReset().mockResolvedValue({ status: 200, text: 'ready' } as any);
  jest.mocked(Notice).mockClear();
});

beforeAll(() => {
  Object.defineProperty(globalThis, 'app', { configurable: true, value: {} });
});

it('uses one picker response for linked text and metadata without changing Zotero selection', async () => {
  const get = jest.mocked(request);
  get.mockResolvedValueOnce('ready').mockResolvedValueOnce(JSON.stringify({
    output: '(Author, 2026, p. 7)',
    pick: [{ citationItems: [{
      locator: '7',
      uris: ['http://zotero.org/users/local/EXAMPLE/items/ABCD1234'],
    }] }],
  }));
  expect(await getCAYW({
    name: 'Linked citation',
    format: 'formatted-citation',
    cslStyle: 'apa',
    citationLinkType: 'zotero-item',
  }, { database: 'Zotero' })).toBe(
    '[(Author, 2026, p. 7)](zotero://select/library/items/ABCD1234)'
  );
  expect(get).toHaveBeenCalledTimes(2);
  expect(get.mock.calls[0][0]).toEqual(expect.objectContaining({
    method: 'GET', url: expect.stringContaining('?probe=true'),
  }));
  expect(get.mock.calls[1][0]).toEqual(expect.objectContaining({
    method: 'POST',
    url: 'http://127.0.0.1:23119/better-bibtex/cayw',
    body: JSON.stringify({ format: 'formatted-citation', style: 'apa' }),
  }));
});

it.each([
  ['url', 'http://zotero.org/users/local/EXAMPLE/items/ABCD1234',
    '/api/users/0/items/ABCD1234', { url: 'https://example.org/paper' },
    'https://example.org/paper'],
  ['doi', 'https://zotero.org/groups/456/items/ABCD1234',
    '/api/groups/456/items/ABCD1234', { DOI: '10.1000/paper' },
    'https://doi.org/10.1000/paper'],
] as const)('fetches a missing %s without a second picker', async (
  linkType, uri, itemPath, data, expectedTarget
) => {
  const get = jest.mocked(request);
  get.mockReset();
  get.mockImplementation(async query => {
    const { url, method } = typeof query === 'string' ? { url: query, method: 'GET' } : query;
    if (url.includes('?probe=true')) return 'ready';
    if (method === 'POST') return JSON.stringify({
      output: '(Author, 2026, p. 7)',
      pick: [{ citationItems: [{ locator: '7', uris: [uri] }] }],
    });
    expect(url).toBe('http://127.0.0.1:23119' + itemPath);
    expect(method).toBe('GET');
    return JSON.stringify({ key: 'ABCD1234', data });
  });

  expect(await getCAYW({
    name: 'Linked citation',
    format: 'formatted-citation',
    citationLinkType: linkType,
  }, { database: 'Zotero' })).toBe(`[(Author, 2026, p. 7)](${expectedTarget})`);
  expect(get.mock.calls.filter(([q]) => typeof q !== 'string' && q.method === 'POST')).toHaveLength(1);
  expect(get.mock.calls.some(([q]) => typeof q !== 'string' && q.url.includes('/api/'))).toBe(true);
});

it.each([
  ['url', { URL: 'https://example.org/paper' }, 'https://example.org/paper'],
  ['doi', { DOI: '10.1000/example' }, 'https://doi.org/10.1000/example'],
] as const)('uses the selected item %s without a metadata lookup', async (type, itemData, target) => {
  const get = jest.mocked(request);
  get.mockReset().mockResolvedValue(JSON.stringify({
    output: '(see Author, 2026, p. 12)',
    pick: [{ citationItems: [{ locator: '12', prefix: 'see', itemData }] }],
  }));
  expect(await getCAYW({
    name: 'Citation', format: 'formatted-citation', citationLinkType: type,
  }, { database: 'Zotero' })).toBe(`[(see Author, 2026, p. 12)](${target})`);
  expect(get).toHaveBeenCalledTimes(1);
});

it('does not reopen the picker when the structured request fails', async () => {
  const get = jest.mocked(request);
  get.mockReset().mockRejectedValue(new Error('timeout'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await getCAYW({
    name: 'Citation', format: 'formatted-citation', citationLinkType: 'doi',
  }, { database: 'Zotero' })).toBeNull();
  expect(get).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

it('keeps multiple selected items as a plain citation', async () => {
  const get = jest.mocked(request);
  get.mockReset().mockResolvedValue(JSON.stringify({
    output: '(A, 2026; B, 2025)',
    pick: [{ citationItems: [{ id: 1 }, { id: 2 }] }],
  }));
  expect(await getCAYW({
    name: 'Citation', format: 'formatted-citation', citationLinkType: 'url',
  }, { database: 'Zotero' })).toBe('(A, 2026; B, 2025)');
  expect(get).toHaveBeenCalledTimes(1);
});

it('keeps the citation when link metadata is unavailable', async () => {
  const get = jest.mocked(request);
  get.mockReset();
  get.mockImplementation(async query => {
    const { url, method } = typeof query === 'string' ? { url: query, method: 'GET' } : query;
    if (url.includes('?probe=true')) return 'ready';
    if (method === 'POST') return JSON.stringify({
      output: '(Author, 2026)',
      pick: [{ citationItems: [{ uris: ['http://zotero.org/users/123/items/ABCD1234'] }] }],
    });
    throw new Error('Local API is unavailable');
  });
  expect(await getCAYW({
    name: 'Linked citation',
    format: 'formatted-citation',
    citationLinkType: 'url',
  }, { database: 'Zotero' })).toBe('(Author, 2026)');
  expect(get.mock.calls.filter(([q]) => typeof q !== 'string' && q.method === 'POST')).toHaveLength(1);
});

it('falls back to one plain picker for an explicitly unsupported POST endpoint', async () => {
  jest.mocked(requestUrl).mockResolvedValue({ status: 400, text: 'Endpoint does not support method\n' } as any);
  const get = jest.mocked(request);
  get.mockReset().mockResolvedValue('(Author, 2026, p. 7)');
  expect(await getCAYW({
    name: 'Legacy', format: 'formatted-citation', cslStyle: 'apa', citationLinkType: 'doi',
  }, { database: 'Zotero' })).toBe('(Author, 2026, p. 7)');
  expect(get).toHaveBeenCalledTimes(1);
  const call = get.mock.calls[0][0] as any;
  expect(call.method).toBe('GET');
  expect(call.url).toContain('format=formatted-citation');
  expect(call.url).toContain('style=apa');
  expect(call.url).not.toMatch(/[?&]select(?:ed)?=/);
  expect(Notice).toHaveBeenCalledWith(expect.stringContaining('plain citation'), 10000);
});

it.each([
  [{ status: 400, text: 'Invalid JSON provided' }, 'invalid request'],
  [{ status: 503, text: 'unavailable' }, 'unavailable service'],
])('does not open a picker for %s', async (probe) => {
  jest.mocked(requestUrl).mockResolvedValue(probe as any);
  const get = jest.mocked(request);
  get.mockReset();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await getCAYW({
    name: 'Error', format: 'formatted-citation', citationLinkType: 'url',
  }, { database: 'Zotero' })).toBeNull();
  expect(get).not.toHaveBeenCalled();
  log.mockRestore();
});

it.each([
  ['cancelled', JSON.stringify({ output: '', pick: [] })],
  ['malformed', '{invalid'],
])('does not retry after a %s selection', async (_label, response) => {
  const get = jest.mocked(request);
  get.mockReset().mockResolvedValue(response);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await getCAYW({
    name: 'Citation', format: 'formatted-citation', citationLinkType: 'doi',
  }, { database: 'Zotero' })).toBeNull();
  expect(get).toHaveBeenCalledTimes(1);
  const call = get.mock.calls[0][0] as any;
  expect(call.method).toBe('POST');
  expect(call.url).not.toMatch(/[?&]select(?:ed)?=/);
  expect(JSON.parse(call.body)).not.toHaveProperty('select');
  expect(JSON.parse(call.body)).not.toHaveProperty('selected');
  log.mockRestore();
});
