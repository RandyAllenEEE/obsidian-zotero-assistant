import type { Vault } from 'obsidian';
import path from 'path';
import { getExeName, getExePath, getExeRoot } from './helpers';

jest.mock('obsidian', () => ({}), { virtual: true });
jest.mock('execa', () => ({}));

const mockVault = () => ({
  adapter: { getFullPath: jest.fn((relative: string) => path.join('/vault', relative)) },
  configDir: '.custom-obsidian',
});

describe('PDF utility location', () => {
  it('resolves the active manifest directory, including mismatched legacy folder names', () => {
    const vault = mockVault();
    getExeRoot(vault as unknown as Vault, {
      id: 'obsidian-zotero-assistant',
      dir: '.custom-obsidian/plugins/legacy-folder',
    });
    expect(vault.adapter.getFullPath).toHaveBeenCalledWith('.custom-obsidian/plugins/legacy-folder');
  });

  it('uses the vault config directory and manifest ID when dir is unavailable', () => {
    const vault = mockVault();
    getExeRoot(vault as unknown as Vault, { id: 'obsidian-zotero-assistant' });
    expect(vault.adapter.getFullPath)
      .toHaveBeenCalledWith('.custom-obsidian/plugins/obsidian-zotero-assistant');
  });

  it('uses the configured override or the executable inside the plugin folder', () => {
    const directory = '/vault/.obsidian/plugins/obsidian-zotero-assistant';
    expect(getExePath(directory)).toBe(path.join(directory, getExeName()));
    expect(getExePath(directory, '/custom/pdf-tool')).toBe('/custom/pdf-tool');
  });
});
