// src/lib/exif/heic-worker.ts
//
// Web Worker for HEIC → JPEG conversion via heic2any.
//
// Source: 15-RESEARCH.md §Pattern 4 — Web Worker for heic2any.
// Loaded from PhotoUploader via:
//   new Worker(new URL('../../lib/exif/heic-worker.ts', import.meta.url),
//              { type: 'module' })
//
// The dynamic `await import('heic2any')` inside the worker tells the
// bundler to emit heic2any (~600KB WASM) as a SEPARATE chunk so it never
// hits the route bundle. See A2 in 15-RESEARCH.md (Turbopack chunk-emission
// verification).

self.onmessage = async (e: MessageEvent) => {
  const { buffer, toType, quality } = e.data as {
    buffer: ArrayBuffer
    toType: string
    quality: number
  }
  // Dynamic import INSIDE the worker — bundler emits heic2any as a
  // separate worker chunk, never preloaded into the route bundle.
  const { default: heic2any } = await import('heic2any')
  const blob = new Blob([buffer])
  const result = await heic2any({ blob, toType, quality })
  const output = Array.isArray(result) ? result[0] : result
  const ab = await output.arrayBuffer()
  // Transfer the buffer — zero-copy.
  ;(self as unknown as Worker).postMessage(
    { buffer: ab, type: output.type },
    [ab],
  )
}

export {} // make this a module
