import { execa } from 'execa';
import fs from 'fs';
import { FileSystemAdapter, Notice, PluginManifest, Vault } from 'obsidian';
import os from 'os';
import path from 'path';

export function getCurrentWindow(ownerWindow?: Window | null) {
  const remote = require('electron').remote;
  const focused = remote.BrowserWindow.getFocusedWindow();
  if (!ownerWindow || ownerWindow === window) {
    return remote.getCurrentWindow();
  }
  return focused ?? remote.getCurrentWindow();
}

export function padNumber(n: number): string {
  return n < 10 ? `0${n}` : n.toString();
}

export function getVaultRoot() {
  return (app.vault.adapter as FileSystemAdapter).getBasePath();
}

export function getExeRoot(vault: Vault, manifest: Pick<PluginManifest, 'dir' | 'id'>) {
  const directory = manifest.dir || path.posix.join(vault.configDir, 'plugins', manifest.id);
  return (vault.adapter as FileSystemAdapter).getFullPath(directory);
}

export function getExePath(directory: string, override?: string) {
  return override || path.join(directory, getExeName());
}

export function getExeName() {
  return os.platform() === 'win32'
    ? 'pdfannots2json.exe'
    : `pdfannots2json-${os.platform()}-${os.arch()}`;
}

export function doesEXEExist(directory: string, override?: string) {
  return fs.existsSync(getExePath(directory, override));
}

export async function checkEXEVersion(directory: string, override?: string) {
  try {
    const result = await execa(getExePath(directory, override), ['-v']);

    if (result.stderr && !result.stderr.includes('warning')) {
      new Notice(`Error checking PDF utility version: ${result.stderr}`, 10000);
      throw new Error(result.stderr);
    }

    return result.stdout.trim();
  } catch (e) {
    console.error(e);
    new Notice(`Error checking PDF utility version: ${e.message}`, 10000);
    throw e;
  }
}

export function getExecutableMode(mode = 0) {
  return (
    mode | fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH
  );
}

function handleError(err: any) {
  console.error('Error: pdfannots2json not executable', err);

  if (err.code === 'ENOENT') {
    return false;
  } else {
    return undefined;
  }
}

export function ensureExecutableSync(file: string) {

  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    //
  }

  try {
    const stats = fs.statSync(file);
    fs.chmodSync(file, getExecutableMode(stats.mode));
    return true;
  } catch (err) {
    return handleError(err);
  }
}
