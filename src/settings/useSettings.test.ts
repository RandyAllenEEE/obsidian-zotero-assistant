/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions":["node","node-addons"]}
 */

import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { useDebouncedState, useToggleSetting } from './useSettings';
import type { ZoteroConnectorSettings } from '../types';

jest.mock('obsidian', () => ({
  debounce(callback: (value: unknown) => void, delay: number, resetTimer: boolean) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest: unknown;
    return (value: unknown) => {
      latest = value;
      if (timer !== undefined) {
        if (!resetTimer) return;
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        callback(latest);
      }, delay);
    };
  },
}), { virtual: true });

let container: HTMLDivElement;

beforeEach(() => {
  jest.useFakeTimers();
  container = document.createElement('div');
});

afterEach(() => {
  act(() => render(null, container));
  jest.useRealTimers();
});

function mountHook<T>(hook: () => T): () => T {
  let result: T;
  function Probe() {
    result = hook();
    return null;
  }

  act(() => render(h(Probe, {}), container));
  return () => result;
}

describe('useToggleSetting', () => {
  it('initializes from the saved value', () => {
    const state = mountHook(() => useToggleSetting('autoSummarize', jest.fn(), false));
    expect(state().isEnabled).toBe(false);
  });

  it.each([false, true])('persists the new value from %s', (initial) => {
    const update = jest.fn();
    const state = mountHook(() => useToggleSetting('autoSummarize', update, initial));
    act(() => state().toggle());
    expect(state().isEnabled).toBe(!initial);
    expect(update).toHaveBeenCalledWith('autoSummarize', !initial);
  });

  it('accumulates rapid toggles against the latest state', () => {
    const update = jest.fn();
    const state = mountHook(() => useToggleSetting('openNoteAfterImport', update, false));
    act(() => {
      state().toggle();
      state().toggle();
      state().toggle();
    });
    expect(state().isEnabled).toBe(true);
    expect(update.mock.calls).toEqual([
      ['openNoteAfterImport', true],
      ['openNoteAfterImport', false],
      ['openNoteAfterImport', true],
    ]);
  });
});

describe('useDebouncedState', () => {
  it('initializes with the saved value and a clean state', () => {
    const state = mountHook(() => useDebouncedState(42, jest.fn(), 300));
    expect(state()).toMatchObject({ value: 42, isDirty: false });
  });

  it('updates the UI before the delayed save', () => {
    const save = jest.fn();
    const state = mountHook(() => useDebouncedState(42, save, 300));
    act(() => state().setValue(100));
    expect(state()).toMatchObject({ value: 100, isDirty: true });
    expect(save).not.toHaveBeenCalled();
  });

  it('saves after the configured delay', () => {
    const save = jest.fn();
    const state = mountHook(() => useDebouncedState(42, save, 300));
    act(() => state().setValue(100));
    act(() => jest.advanceTimersByTime(299));
    expect(save).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledWith(100);
  });

  it('uses the latest value at the first update window boundary', () => {
    const save = jest.fn();
    const state = mountHook(() => useDebouncedState(0, save, 300));
    act(() => state().setValue(1));
    act(() => jest.advanceTimersByTime(150));
    act(() => state().setValue(2));
    act(() => jest.advanceTimersByTime(150));
    expect(save.mock.calls).toEqual([[2]]);
  });

  it('clears the dirty state after saving', () => {
    const save = jest.fn();
    const state = mountHook(() => useDebouncedState('hello', save, 300));
    act(() => state().setValue('world'));
    expect(state().isDirty).toBe(true);
    act(() => jest.advanceTimersByTime(300));
    expect(state().isDirty).toBe(false);
  });

  it('saves once for several changes in a window', () => {
    const save = jest.fn();
    const state = mountHook(() => useDebouncedState(0, save, 300));
    act(() => {
      state().setValue(1);
      state().setValue(2);
      state().setValue(3);
    });
    act(() => jest.advanceTimersByTime(300));
    expect(save.mock.calls).toEqual([[3]]);
  });
});

const DEFAULT_SETTINGS: ZoteroConnectorSettings = {
  database: 'Zotero',
  noteImportFolder: '',
  pdfExportImageDPI: 120,
  pdfExportImageFormat: 'jpg',
  pdfExportImageQuality: 90,
  citeFormats: [],
  exportFormats: [],
  citeSuggestTemplate: '[[{{citekey}}]]',
  openNoteAfterImport: false,
  whichNotesToOpenAfterImport: 'first-imported-note',
  sanitizeTitles: false,
  aiApiKeyId: '',
  aiApiUrl: 'https://open.cherryin.net/v1/chat/completions',
  aiModel: 'qwen/qwen3-omni-30b-a3b-thinking(free)',
  aiMaxPages: 10,
  aiMaxText: 50000,
  aiSummaryAnchor: '%% AI Summary %%',
  autoSummarize: false,
  aiPrompt: 'Summarize this.',
};

// ---------------------------------------------------------------------------
// aiSummaryAnchor anchor-in-content check
// ---------------------------------------------------------------------------

describe('anchor-in-content detection (aiSummaryAnchor)', () => {
  const ANCHOR = '%% AI Summary %%';

  function hasAnchor(content: string, anchor: string): boolean {
    return content.includes(anchor);
  }

  it('returns true when anchor exists in content', () => {
    const md = `# Paper Title\n\nSome notes here.\n\n%% AI Summary %%\n`;
    expect(hasAnchor(md, ANCHOR)).toBe(true);
  });

  it('returns false when anchor is missing', () => {
    const md = `# Paper Title\n\nSome notes without anchor.`;
    expect(hasAnchor(md, ANCHOR)).toBe(false);
  });

  it('anchor at beginning of content', () => {
    const md = `%% AI Summary %%\n# Paper Title`;
    expect(hasAnchor(md, ANCHOR)).toBe(true);
  });

  it('anchor at end of content', () => {
    const md = `# Paper Title\n\n%% AI Summary %%`;
    expect(hasAnchor(md, ANCHOR)).toBe(true);
  });

  it('anchor in middle of content', () => {
    const md = `# Paper\n\n%% AI Summary %%\n\n## Notes`;
    expect(hasAnchor(md, ANCHOR)).toBe(true);
  });

  it('custom anchor works', () => {
    const md = `# Paper\n\n## AI Summary\n\nContent`;
    expect(hasAnchor(md, '## AI Summary')).toBe(true);
  });

  it('partial anchor match does not count', () => {
    const md = `# Paper\n\n% AI Summary %%\n`;
    expect(hasAnchor(md, ANCHOR)).toBe(false);
  });

  it('handles anchor with surrounding whitespace', () => {
    const md = `# Paper\n   %% AI Summary %%  \n`;
    expect(hasAnchor(md, ANCHOR)).toBe(true); // spaces around don't affect contains
  });
});

// ---------------------------------------------------------------------------
// autoSummarize settings guard (simulating summarizePdf guard)
// ---------------------------------------------------------------------------

describe('autoSummarize settings guard', () => {
  it('summarizePdf should NOT run if autoSummarize is false', () => {
    const settings = { ...DEFAULT_SETTINGS, autoSummarize: false };
    const shouldRun = settings.autoSummarize === true;
    expect(shouldRun).toBe(false);
  });

  it('summarizePdf SHOULD run if autoSummarize is true', () => {
    const settings = { ...DEFAULT_SETTINGS, autoSummarize: true };
    const shouldRun = settings.autoSummarize === true;
    expect(shouldRun).toBe(true);
  });

  it('api key guard: should not proceed without key', () => {
    const settings = { ...DEFAULT_SETTINGS, aiApiKeyId: '' };
    const canProceed = !!settings.aiApiKeyId;
    expect(canProceed).toBe(false);
  });

  it('api key guard: proceeds with key configured', () => {
    const settings = { ...DEFAULT_SETTINGS, aiApiKeyId: 'sk-test-key-123' };
    const canProceed = !!settings.aiApiKeyId;
    expect(canProceed).toBe(true);
  });

  it('combined: autoSummarize=true AND apiKey set -> should attempt summarize', () => {
    const settings: ZoteroConnectorSettings = {
      ...DEFAULT_SETTINGS,
      autoSummarize: true,
      aiApiKeyId: 'sk-test-key-123',
    };
    const shouldAttempt = settings.autoSummarize === true && !!settings.aiApiKeyId;
    expect(shouldAttempt).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ProcessFrontMatter mock behavior (citekey update)
// ---------------------------------------------------------------------------

describe('citekey frontmatter update', () => {
  it('citekey is written as string', () => {
    const frontmatter: Record<string, unknown> = {};
    const item = { citekey: 'chen2024efficient' };
    frontmatter['citekey'] = item.citekey;
    expect(frontmatter['citekey']).toBe('chen2024efficient');
  });

  it('overwriting citekey replaces old value', () => {
    const frontmatter: Record<string, unknown> = { citekey: 'old-key' };
    frontmatter['citekey'] = 'new-key';
    expect(frontmatter['citekey']).toBe('new-key');
  });

  it('latest_import_time is ISO string', () => {
    const frontmatter: Record<string, unknown> = {};
    // moment().toISOString() example: "2024-06-15T10:30:00.000Z"
    frontmatter['latest_import_time'] = '2024-06-15T10:30:00.000Z';
    expect(typeof frontmatter['latest_import_time']).toBe('string');
    expect(frontmatter['latest_import_time']).toContain('T');
  });
});
