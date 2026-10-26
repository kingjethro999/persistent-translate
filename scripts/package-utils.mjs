import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function walkFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Unexpected symbolic link: ${path}`);
    if (entry.isDirectory()) results.push(...(await walkFiles(path)));
    else results.push(path);
  }
  return results.sort();
}

export function archivePath(path) {
  assert(
    path &&
      !path.startsWith('/') &&
      !/^[A-Za-z]:/.test(path) &&
      !path.includes('\\') &&
      !path.includes('\0') &&
      !path.split('/').some((part) => part === '..' || part === '.'),
    'Unsafe archive path',
  );
  return path;
}

// Production archives are small enough to validate fully in memory. Reject ZIP64,
// encryption, links, duplicate names, corrupt data, and decompression bombs.
export async function readZip(path) {
  const data = await readFile(path);
  assert(data.length <= 64 * 1024 * 1024, `Archive exceeds 64 MiB: ${path}`);
  let end = -1;
  for (
    let offset = data.length - 22;
    offset >= Math.max(0, data.length - 65557);
    offset--
  ) {
    if (
      data.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + data.readUInt16LE(offset + 20) === data.length
    ) {
      end = offset;
      break;
    }
  }
  assert(end >= 0, `Invalid ZIP end record: ${path}`);
  assert(
    data.readUInt16LE(end + 4) === 0 && data.readUInt16LE(end + 6) === 0,
    'Split ZIP unsupported',
  );
  const count = data.readUInt16LE(end + 10);
  assert(
    count > 0 && count < 65535 && count === data.readUInt16LE(end + 8),
    'Invalid ZIP entry count',
  );
  let offset = data.readUInt32LE(end + 16);
  const centralEnd = offset + data.readUInt32LE(end + 12);
  assert(centralEnd === end, 'ZIP central directory bounds mismatch');
  const files = new Map();
  const names = new Set();
  let total = 0;
  for (let index = 0; index < count; index++) {
    assert(
      offset + 46 <= centralEnd && data.readUInt32LE(offset) === 0x02014b50,
      'Invalid ZIP directory',
    );
    const flags = data.readUInt16LE(offset + 8);
    const method = data.readUInt16LE(offset + 10);
    const expectedCrc = data.readUInt32LE(offset + 16);
    const compressedSize = data.readUInt32LE(offset + 20);
    const size = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const nameEnd = offset + 46 + nameLength;
    assert(nameEnd <= centralEnd, 'ZIP filename out of bounds');
    const name = archivePath(
      data.subarray(offset + 46, nameEnd).toString('utf8'),
    );
    assert(!names.has(name), `Duplicate ZIP entry: ${name}`);
    names.add(name);
    assert(
      (flags & 1) === 0 && (method === 0 || method === 8),
      `Unsupported ZIP encoding: ${name}`,
    );
    assert(
      ((data.readUInt32LE(offset + 38) >>> 16) & 0xf000) !== 0xa000,
      `ZIP link rejected: ${name}`,
    );
    const local = data.readUInt32LE(offset + 42);
    assert(
      local + 30 <= data.length && data.readUInt32LE(local) === 0x04034b50,
      'Invalid local ZIP header',
    );
    const start =
      local +
      30 +
      data.readUInt16LE(local + 26) +
      data.readUInt16LE(local + 28);
    assert(
      start + compressedSize <= data.readUInt32LE(end + 16),
      'ZIP data out of bounds',
    );
    total += size;
    assert(
      size <= 16 * 1024 * 1024 && total <= 64 * 1024 * 1024,
      'ZIP unpacked size exceeds budget',
    );
    const compressed = data.subarray(start, start + compressedSize);
    const contents =
      method === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: 16 * 1024 * 1024 });
    assert(
      contents.length === size && crc32(contents) === expectedCrc,
      `ZIP checksum mismatch: ${name}`,
    );
    if (!name.endsWith('/')) files.set(name, contents);
    offset =
      nameEnd + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
  }
  assert(offset === centralEnd, 'ZIP directory length mismatch');
  return files;
}

export function localPath(directory, path) {
  archivePath(path);
  const resolved = join(directory, path);
  assert(
    !relative(directory, resolved).startsWith('..'),
    'Asset escapes build folder',
  );
  return resolved;
}
