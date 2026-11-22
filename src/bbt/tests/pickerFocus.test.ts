import type { App } from 'obsidian';

import { getCurrentWindow } from '../../helpers';
import { capturePickerFocus } from '../pickerFocus';

jest.mock('obsidian', () => ({ MarkdownView: class MarkdownView {} }), {
  virtual: true,
});
jest.mock('../../helpers', () => ({ getCurrentWindow: jest.fn() }));

function fixture() {
  const editor = { focus: jest.fn() };
  const file = { path: 'Original.md' };
  const ownerWindow = {};
  const leaf = { view: { containerEl: { ownerDocument: { defaultView: ownerWindow } } } };
  const workspace = {
    activeLeaf: leaf,
    activeEditor: { file, editor },
    getActiveFile: jest.fn().mockReturnValue(file),
  };
  const win = {
    isDestroyed: jest.fn().mockReturnValue(false),
    isMinimized: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    isFocused: jest.fn().mockReturnValue(false),
    focus: jest.fn(),
    webContents: {
      isFocused: jest.fn().mockReturnValue(false),
      focus: jest.fn(),
    },
  };
  jest.mocked(getCurrentWindow).mockReturnValue(win);

  return {
    editor,
    workspace,
    win,
    ownerWindow,
    focus: capturePickerFocus({ workspace } as unknown as App),
  };
}

it('restores the captured native window and editor, in that order', () => {
  const { focus, win, editor, ownerWindow } = fixture();
  expect(getCurrentWindow).toHaveBeenLastCalledWith(ownerWindow);
  focus.restore();
  expect(win.focus).toHaveBeenCalledTimes(1);
  expect(win.webContents.focus).toHaveBeenCalledTimes(1);
  expect(editor.focus).toHaveBeenCalledTimes(1);
  expect(win.focus.mock.invocationCallOrder[0]).toBeLessThan(editor.focus.mock.invocationCallOrder[0]);
});

it('skips the return when the same editor was reused for another note', () => {
  const { focus, workspace, win, editor } = fixture();
  workspace.activeEditor.file = { path: 'Other.md' };
  workspace.getActiveFile.mockReturnValue(workspace.activeEditor.file);
  expect(focus.isCurrent()).toBe(false);
  focus.restore();
  expect(win.focus).not.toHaveBeenCalled();
  expect(editor.focus).not.toHaveBeenCalled();
});

it('skips the return when the originating window closed', () => {
  const { focus, win, editor } = fixture();
  win.isDestroyed.mockReturnValue(true);
  focus.restore();
  expect(win.focus).not.toHaveBeenCalled();
  expect(editor.focus).not.toHaveBeenCalled();
});
