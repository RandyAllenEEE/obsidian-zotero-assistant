/** @jest-environment node */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { zipSync } from 'fflate';
import { pack } from 'tar-stream';
import { getPdfUtilityAsset, installPdfUtility } from './pdfUtilityInstaller';

const executable = Buffer.from('PDF utility test fixture');
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
let directory: string;
let target: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'zotero-pdf-utility-test-'));
  target = join(directory, 'pdfannots2json');
  await writeFile(target, 'existing executable');
});

afterEach(async () => {
  await unlink(target);
  await rmdir(directory);
});

test('installs only the executable from the verified ZIP', async () => {
  const archive = zipSync({ 'pdfannots2json.exe': executable, 'README.txt': executable });
  await installPdfUtility(archive, { format: 'zip', sha256: hash(archive) }, target);
  expect(await readFile(target)).toEqual(executable);
  expect(await readdir(directory)).toEqual(['pdfannots2json']);
});

test('handles the executable path used in the upstream tarballs', async () => {
  const tar = pack();
  tar.entry({ name: './pdfannots2json' }, executable);
  tar.finalize();
  const chunks: Buffer[] = [];
  for await (const chunk of tar) {
    if (!Buffer.isBuffer(chunk)) throw new Error('Expected a tar buffer');
    chunks.push(chunk);
  }
  const archive = gzipSync(Buffer.concat(chunks));
  await installPdfUtility(archive, { format: 'tar.gz', sha256: hash(archive) }, target);
  expect(await readFile(target)).toEqual(executable);
});

test('keeps an existing utility when the checksum or executable is missing', async () => {
  const archive = zipSync({ 'README.txt': executable });
  await expect(installPdfUtility(archive, { format: 'zip', sha256: '' }, target)).rejects.toThrow('SHA-256 mismatch');
  await expect(installPdfUtility(archive, { format: 'zip', sha256: hash(archive) }, target)).rejects.toThrow('missing from archive');
  expect(await readFile(target, 'utf8')).toBe('existing executable');
});

test('links only supported operating systems and architectures to pinned archives', () => {
  for (const [platform, arch] of [['darwin', 'x64'], ['darwin', 'arm64'], ['linux', 'x64'], ['win32', 'x64']]) {
    const asset = getPdfUtilityAsset(platform, arch);
    expect(asset?.sha256).toMatch(/^[a-f\d]{64}$/);
    expect(asset?.url).toContain('/releases/download/1.0.15/');
  }
  expect(getPdfUtilityAsset('win32', 'arm64')).toBeUndefined();
});
