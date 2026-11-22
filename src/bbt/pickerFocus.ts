import { App, Editor, MarkdownView } from 'obsidian';

import { getCurrentWindow } from '../helpers';

export function capturePickerFocus(
  app: App,
  editor: Editor | undefined = app.workspace.activeEditor?.editor
) {
  const leaf = app.workspace.activeLeaf;
  const view = leaf?.view;
  const file = app.workspace.getActiveFile();
  const editorFile = app.workspace.activeEditor?.file;
  const win = getCurrentWindow(view?.containerEl.ownerDocument.defaultView);

  const isCurrent = () =>
    app.workspace.activeLeaf === leaf &&
    leaf?.view === view &&
    app.workspace.getActiveFile() === file &&
    (!editor ||
      (app.workspace.activeEditor?.editor === editor &&
        app.workspace.activeEditor.file === editorFile)) &&
    !win?.isDestroyed();

  const restore = () => {
    if (!isCurrent()) return;
    if (win) {
      if (win.isMinimized() || !win.isVisible()) win.show();
      if (!win.isFocused()) win.focus();
      if (!win.webContents.isFocused()) win.webContents.focus();
    }
    if (!(view instanceof MarkdownView) || view.getMode() === 'source') {
      editor?.focus();
    }
  };

  return { isCurrent, restore };
}
