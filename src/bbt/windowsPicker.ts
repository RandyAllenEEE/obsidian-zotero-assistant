import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

// Running from the Electron main process lets its child transfer the foreground
// when the newly opened Zotero dialog needs help activating on Windows.
const watchDialog = String.raw`
$ErrorActionPreference = 'Stop'
$port = $env:ZOTERO_ASSISTANT_PICKER_PORT
$origin = [long]$env:ZOTERO_ASSISTANT_PICKER_ORIGIN
$pattern = '^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0):' + $port + '\s+0\.0\.0\.0:0\s+\S+\s+(\d+)\s*$'
$listener = & "$env:SystemRoot\System32\netstat.exe" -ano -p tcp | ForEach-Object {
  if ($_ -match $pattern) { [int]$Matches[1] }
} | Select-Object -First 1
if (!$listener -or (Get-Process -Id $listener).ProcessName -ne 'zotero') { exit }

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class ZoteroPicker {
    private delegate bool InspectWindow(IntPtr window, IntPtr param);
    [DllImport("user32.dll")] private static extern bool EnumWindows(InspectWindow inspect, IntPtr param);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out int owner);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, StringBuilder name, int length);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);

    private static List<IntPtr> Dialogs(int zotero, bool visibleOnly) {
        var result = new List<IntPtr>();
        EnumWindows((window, param) => {
            int owner;
            GetWindowThreadProcessId(window, out owner);
            if (owner != zotero || (visibleOnly && (!IsWindowVisible(window) || GetWindowTextLength(window) == 0))) return true;
            var name = new StringBuilder(64);
            GetClassName(window, name, name.Capacity);
            if (name.ToString() == "MozillaDialogClass") result.Add(window);
            return true;
        }, IntPtr.Zero);
        return result;
    }

    public static void Watch(int zotero, long originatingWindow) {
        var origin = new IntPtr(originatingWindow);
        var existing = new HashSet<IntPtr>(Dialogs(zotero, false));
        Console.WriteLine("ready");
        var elapsed = Stopwatch.StartNew();
        while (elapsed.ElapsedMilliseconds < 3000 && GetForegroundWindow() == origin) {
            var opened = Dialogs(zotero, true);
            opened.RemoveAll(existing.Contains);
            if (opened.Count > 1) return;
            if (opened.Count == 1 && GetForegroundWindow() == origin) {
                SetForegroundWindow(opened[0]);
                return;
            }
            Thread.Sleep(30);
        }
    }
}
'@

[ZoteroPicker]::Watch([int]$listener, $origin)
`;

export async function prepareWindowsPicker(url: string): Promise<(() => void) | undefined> {
  if (process.platform !== 'win32' || !process.env.SystemRoot) return;
  const endpoint = new URL(url);
  if (endpoint.hostname !== '127.0.0.1' || !endpoint.port) return;

  try {
    const remote = require('electron').remote;
    const win = remote.BrowserWindow.getFocusedWindow();
    if (!win || !win.isFocused()) return;
    const handle: Buffer = win.getNativeWindowHandle();
    const origin = handle.length === 8 ? handle.readBigUInt64LE() : handle.readUInt32LE();
    const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child: ChildProcessWithoutNullStreams = remote.require('node:child_process').spawn(
      powershell,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(watchDialog, 'utf16le').toString('base64')],
      {
        windowsHide: true,
        env: {
          ...process.env,
          ZOTERO_ASSISTANT_PICKER_PORT: endpoint.port,
          ZOTERO_ASSISTANT_PICKER_ORIGIN: String(origin),
        },
      }
    );
    const stop = () => {
      if (child.exitCode === null && !child.killed) child.kill();
    };
    const ready = await new Promise<boolean>((resolve) => {
      const finish = (watching: boolean) => {
        clearTimeout(timeout);
        resolve(watching);
      };
      const timeout = setTimeout(() => finish(false), 1800);
      child.stdout.once('data', (chunk: Buffer) => finish(chunk.toString().trim() === 'ready'));
      child.once('exit', () => finish(false));
      child.once('error', () => finish(false));
      child.stderr.resume();
    });
    if (ready) return stop;
    stop();
  } catch {
    // Let Zotero present the picker normally if the Windows helper is unavailable.
  }
}
