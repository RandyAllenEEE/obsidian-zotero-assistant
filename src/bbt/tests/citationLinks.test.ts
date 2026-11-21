import {
  formatCitationMarkdownLink,
  getCitationLinkType,
  getDoiLink,
  getUrlLink,
  getZoteroItemLink,
  normalizeDoiLink,
  parseCaywCitationResponse,
  resolveCitationLinkTarget,
} from '../citationLinks';

describe('getCitationLinkType()', () => {
  it('uses explicit citationLinkType before the legacy boolean', () => {
    expect(
      getCitationLinkType({
        citationLinkType: 'doi',
        addZoteroLink: true,
      })
    ).toBe('doi');
  });

  it('maps legacy addZoteroLink to zotero-item', () => {
    expect(getCitationLinkType({ addZoteroLink: true })).toBe('zotero-item');
  });

  it('defaults to none when no link is configured', () => {
    expect(getCitationLinkType({})).toBe('none');
    expect(getCitationLinkType({ addZoteroLink: false })).toBe('none');
  });
});

describe('getZoteroItemLink()', () => {
  it('uses an existing zotero select link', () => {
    expect(
      getZoteroItemLink({
        select: 'zotero://select/library/items/HYEQSLC8',
      })
    ).toBe('zotero://select/library/items/HYEQSLC8');
  });

  it('builds a personal library select link from uri', () => {
    expect(
      getZoteroItemLink({
        uri: 'http://zotero.org/users/123/items/HYEQSLC8',
      })
    ).toBe('zotero://select/library/items/HYEQSLC8');
  });

  it('builds a group library select link from uri', () => {
    expect(
      getZoteroItemLink({
        item: {
          uri: 'http://zotero.org/groups/456/items/HYEQSLC8',
        },
      })
    ).toBe('zotero://select/groups/456/items/HYEQSLC8');
  });

  it('falls back to itemKey for personal library links', () => {
    expect(
      getZoteroItemLink({
        item: {
          itemKey: 'HYEQSLC8',
        },
      })
    ).toBe('zotero://select/library/items/HYEQSLC8');
  });

  it('reads the real Better BibTeX CAYW shape from Zotero', () => {
    expect(
      getZoteroItemLink({
        uri: 'http://zotero.org/users/17778967/items/JVDT96UL',
        item: {
          DOI: '10.1109/TPWRD.2023.3246719',
          url: 'https://ieeexplore.ieee.org/document/10049127',
          itemKey: 'JVDT96UL',
        },
      })
    ).toBe('zotero://select/library/items/JVDT96UL');
  });
});

describe('URL and DOI links', () => {
  it('reads URL fields from common Zotero payload positions', () => {
    expect(
      getUrlLink({
        item: {
          URL: 'https://example.com/paper',
        },
      })
    ).toBe('https://example.com/paper');
  });

  it('normalizes DOI values to doi.org URLs', () => {
    expect(normalizeDoiLink('doi: 10.1109/example.2024.1')).toBe(
      'https://doi.org/10.1109/example.2024.1'
    );
    expect(getDoiLink({ data: { doi: 'https://doi.org/10.1000/test(1)' } }))
      .toBe('https://doi.org/10.1000/test(1)');
  });

  it('reads DOI and URL from the nested item in real CAYW JSON', () => {
    const item = {
      uri: 'http://zotero.org/users/17778967/items/JVDT96UL',
      item: {
        DOI: '10.1109/TPWRD.2023.3246719',
        url: 'https://ieeexplore.ieee.org/document/10049127',
      },
    };

    expect(getUrlLink(item)).toBe('https://ieeexplore.ieee.org/document/10049127');
    expect(getDoiLink(item)).toBe('https://doi.org/10.1109/TPWRD.2023.3246719');
  });
});

describe('resolveCitationLinkTarget()', () => {
  it('falls back without a link for multiple selected items', () => {
    expect(
      resolveCitationLinkTarget([{ itemKey: 'AAA' }, { itemKey: 'BBB' }], 'doi')
    ).toEqual({
      linkType: 'doi',
      reason: 'multi-select',
    });
  });

  it('falls back without a link when the configured target is missing', () => {
    expect(resolveCitationLinkTarget([{ title: 'No URL here' }], 'url')).toEqual(
      {
        linkType: 'url',
        reason: 'missing-target',
      }
    );
  });

  it('falls back as missing target when no item data is available', () => {
    expect(resolveCitationLinkTarget([], 'zotero-item')).toEqual({
      linkType: 'zotero-item',
      reason: 'missing-target',
    });
  });

  it('returns a target for a single selected item', () => {
    expect(
      resolveCitationLinkTarget(
        [{ DOI: 'https://dx.doi.org/10.1000/example' }],
        'doi'
      )
    ).toEqual({
      linkType: 'doi',
      target: 'https://doi.org/10.1000/example',
    });
  });
});

describe('formatCitationMarkdownLink()', () => {
  it('escapes link text and wraps complex targets', () => {
    expect(
      formatCitationMarkdownLink(
        'Example ] citation',
        'https://example.com/paper (accepted)'
      )
    ).toBe('[Example \\] citation](<https://example.com/paper (accepted)>)');
  });
});

describe('parseCaywCitationResponse()', () => {
  it('uses the rendered text and link data from the same pick', () => {
    const { output, items } = parseCaywCitationResponse(JSON.stringify({
      output: '(Author, 2026, p. 42)',
      pick: [{ citationItems: [{
        locator: '42',
        uris: ['http://zotero.org/groups/456/items/HYEQSLC8'],
        itemData: { DOI: '10.1000/example' },
      }] }],
    }));
    expect(output).toBe('(Author, 2026, p. 42)');
    expect(resolveCitationLinkTarget(items, 'zotero-item').target)
      .toBe('zotero://select/groups/456/items/HYEQSLC8');
    expect(resolveCitationLinkTarget(items, 'doi').target)
      .toBe('https://doi.org/10.1000/example');
  });

  it('treats a cancelled picker as empty and keeps multi-item fallback', () => {
    expect(parseCaywCitationResponse('{"output":"","pick":[]}'))
      .toEqual({ output: '', items: [] });
    const { items } = parseCaywCitationResponse(JSON.stringify({
      output: '(A, 2026; B, 2025)',
      pick: [{ citationItems: [{ id: 1 }, { id: 2 }] }],
    }));
    expect(resolveCitationLinkTarget(items, 'zotero-item').reason)
      .toBe('multi-select');
  });
});
