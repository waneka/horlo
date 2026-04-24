// Ambient declaration for exifr's lite ESM build, which the package ships
// without bundled type definitions. We only consume the orientation()
// helper from this entry point (see src/lib/exif/strip.ts).

declare module 'exifr/dist/lite.esm.js' {
  /** Read just the EXIF Orientation tag. Returns undefined when absent. */
  export function orientation(input: Blob | ArrayBuffer): Promise<number | undefined>
  // exifr's lite build also exports parse + other helpers; declare the
  // primary surface we use here. Add more exports as we consume them.
}
