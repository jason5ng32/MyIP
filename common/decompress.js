// Single entry point for stream decompression. New formats become a switch
// case here rather than a new dependency in every updater file.
//
//   gzip  → Node built-in zlib (no dep)
//   bzip2 → unbzip2-stream (Node has no native bzip2)

import zlib from 'zlib';
import unbzip2Stream from 'unbzip2-stream';

export function createDecompressor(format) {
    switch (format) {
        case 'gzip':  return zlib.createGunzip();
        case 'bzip2': return unbzip2Stream();
        default:
            throw new Error(`Unsupported decompression format: ${format}`);
    }
}
