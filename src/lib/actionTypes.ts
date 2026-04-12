// Shared result type for all Server Actions (D-12).
// Actions return this instead of throwing, so the client can discriminate success/failure
// without catching raw errors across the server/client boundary.
// Lives in src/lib/ (not src/app/actions/) so it can be imported by client code for type-checking.
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
