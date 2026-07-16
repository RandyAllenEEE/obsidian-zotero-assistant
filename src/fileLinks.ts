import { pathToFileURL } from 'url';

export interface FileAttachment {
  desktopURI?: unknown;
  path?: unknown;
  title?: unknown;
}

function decodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createFileUri(pathname: string, hostname = ''): string {
  const url = new URL(hostname ? `file://${hostname}/` : 'file:///');
  url.pathname = pathname;
  return url.href;
}

export function isPdfPath(value: unknown): value is string {
  return typeof value === 'string' && /\.pdf$/i.test(value.trim());
}

export function getFirstPdfAttachment(
  attachments: unknown
): FileAttachment | undefined {
  if (!Array.isArray(attachments)) return undefined;

  return attachments.find((attachment) => isPdfPath(attachment?.path));
}

export function localPathToFileUri(localPath: string): string {
  const value = localPath.trim();
  if (!value) throw new Error('Cannot create a file URI from an empty path');

  const windowsDrivePath = /^([a-zA-Z]:)[\\/](.*)$/.exec(value);
  if (windowsDrivePath) {
    const pathname = `/${windowsDrivePath[1]}/${windowsDrivePath[2].replace(
      /\\/g,
      '/'
    )}`;
    return createFileUri(pathname);
  }

  const uncPath = /^[/\\]{2}([^/\\]+)[/\\](.*)$/.exec(value);
  if (uncPath) {
    return createFileUri(`/${uncPath[2].replace(/\\/g, '/')}`, uncPath[1]);
  }

  if (value.startsWith('/')) return createFileUri(value);

  return pathToFileURL(value).href;
}

export function fileUriToLocalPath(fileUri: string): string {
  const value = fileUri.trim();
  if (!value) throw new Error('Cannot resolve an empty file URI');

  if (!/^file:/i.test(value)) return decodeUriComponent(value);

  const legacyWindowsPath = /^file:\/\/([a-zA-Z]:[\\/].*)$/i.exec(value);
  if (legacyWindowsPath) {
    return decodeUriComponent(legacyWindowsPath[1]).replace(/\//g, '\\');
  }

  const url = new URL(value.replace(/\\/g, '/'));
  const pathname = decodeUriComponent(url.pathname);

  if (/^\/[a-zA-Z]:\//.test(pathname)) {
    return pathname.substring(1).replace(/\//g, '\\');
  }

  if (url.hostname) {
    if (process.platform === 'win32') {
      return `\\\\${url.hostname}${pathname.replace(/\//g, '\\')}`;
    }

    // Compatibility with legacy POSIX URIs emitted as file://home/user/file.pdf.
    return `/${url.hostname}${pathname}`;
  }

  return pathname;
}

export function formatMarkdownLink(text: unknown, target: string): string {
  const label =
    typeof text === 'string' && text.trim() ? text.trim() : 'Attachment';
  const escapedLabel = label.replace(/\]/g, '\\]');
  const destination = /[\s()]/.test(target) ? `<${target}>` : target;

  return `[${escapedLabel}](${destination})`;
}

export function formatAttachmentFileLink(
  attachment: FileAttachment
): string | undefined {
  if (typeof attachment.path !== 'string' || !attachment.path.trim()) {
    return undefined;
  }

  return formatMarkdownLink(
    attachment.title,
    localPathToFileUri(attachment.path)
  );
}

export function formatAttachmentZoteroLink(
  attachment: FileAttachment
): string | undefined {
  if (
    typeof attachment.desktopURI !== 'string' ||
    !attachment.desktopURI.trim()
  ) {
    return undefined;
  }

  return formatMarkdownLink(attachment.title, attachment.desktopURI.trim());
}
