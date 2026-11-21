import { createHash } from 'node:crypto';
import { mkdtemp, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { unzipSync } from 'fflate';
import { extract } from 'tar-stream';

type ArchiveFormat = 'zip' | 'tar.gz';

type PdfUtilityAsset = {
  file: string;
  sha256: string;
  format: ArchiveFormat;
};

export const currentVersion = '1.0.15';
const assets: Partial<Record<string, PdfUtilityAsset>> = {
  'darwin-x64': {
    file: 'pdfannots2json.Mac.Intel.tar.gz',
    sha256: 'ce42fee021b37c38fe131db236ca7711282af899a82eaaaf074bdcc6aebb6c74',
    format: 'tar.gz',
  },
  'darwin-arm64': {
    file: 'pdfannots2json.Mac.M1.tar.gz',
    sha256: 'c230a4e578e1c2ff2475cb7f6f59d5ee92e4769e7a3b0ef1cee96444922bc5d5',
    format: 'tar.gz',
  },
  'linux-x64': {
    file: 'pdfannots2json.Linux.x64.tar.gz',
    sha256: 'f5cc05baa70ac15da2cc358c79acb296b8630cdc654ed304acf50bd9489a94bd',
    format: 'tar.gz',
  },
  'win32-x64': {
    file: 'pdfannots2json.Windows.x64.zip',
    sha256: '0d1496dce3518a4f6523af784051ddd1f1a2083690da41d39da7a198199aa4f3',
    format: 'zip',
  },
};

export function getPdfUtilityAsset(platform: string, arch: string) {
  const asset = assets[platform + '-' + arch];
  return asset && {
    ...asset,
    url: 'https://github.com/mgmeyers/pdfannots2json/releases/download/' + currentVersion + '/' + asset.file,
  };
}

async function readTarExecutable(archive: Uint8Array) {
  const tar = extract();
  let executable: Buffer | undefined;

  tar.on('entry', (header, stream, next) => {
    if (header.type !== 'file' || header.name !== './pdfannots2json') {
      stream.on('end', next);
      stream.resume();
      return;
    }

    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      if (executable) return next(new Error('Duplicate PDF utility executable'));
      executable = Buffer.concat(chunks);
      next();
    });
  });

  await pipeline(Readable.from([archive]), createGunzip(), tar);
  return executable;
}

export async function installPdfUtility(
  archive: Uint8Array,
  asset: Pick<PdfUtilityAsset, 'sha256' | 'format'>,
  target: string
) {
  const actualHash = createHash('sha256').update(archive).digest('hex');
  if (actualHash !== asset.sha256) {
    throw new Error('PDF utility archive SHA-256 mismatch');
  }

  const executable = asset.format === 'zip'
    ? unzipSync(archive, { filter: (entry) => entry.name === 'pdfannots2json.exe' })['pdfannots2json.exe']
    : await readTarExecutable(archive);
  if (!executable?.byteLength) throw new Error('PDF utility executable missing from archive');

  const tempDirectory = await mkdtemp(join(dirname(target), '.pdfannots2json-'));
  const staged = join(tempDirectory, 'pdfannots2json');
  try {
    await writeFile(staged, executable, { flag: 'wx', mode: 0o755 });
    await rename(staged, target);
  } finally {
    await unlink(staged).catch((error) => {
      if (error.code !== 'ENOENT') console.error(error);
    });
    await rmdir(tempDirectory).catch((error) => console.error(error));
  }
}
