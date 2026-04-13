// Vitest shim for Next.js `server-only` guard.
// Importing this file in tests is a no-op; the real `server-only` package
// throws at build time if imported into a client bundle, which would break
// unit tests that deliberately exercise server-only modules.
export {}
