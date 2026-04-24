// src/lib/exif/strip.ts
//
// Shared canvas resize + EXIF-strip helper.
//
// Sources:
// - 15-RESEARCH.md §Pattern 5 — Shared canvas resize + EXIF-strip helper
// - 15-RESEARCH.md §Pitfall 4 — EXIF orientation (createImageBitmap primary, exifr fallback)
// - 15-RESEARCH.md §Pitfall 5 — EXIF GPS stripped on ALL paths
// - 15-CONTEXT.md D-10 — EXIF stripping + 1080px resize on both paths
//
// Canvas.toBlob('image/jpeg', q) cannot preserve EXIF — re-encoding always
// drops all metadata. We use createImageBitmap with `imageOrientation:
// 'from-image'` as the primary EXIF-orientation correction (Safari 16.4+,
// Chrome 59+, Firefox 98+); on older iOS Safari we fall back to reading
// the EXIF orientation tag with exifr/dist/lite and applying canvas
// transforms before drawImage.
//
// STATE.md research-flag resolution: createImageBitmap primary + exifr
// fallback. See Pitfall 4 evidence (caniuse + WebKit commit 253004@main).

export interface StripResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Re-encode a Blob through a canvas, stripping all EXIF metadata and
 * resizing so the longest edge is <= maxDim.
 *
 * @param input  Source blob (HEIC-converted JPEG, raw user-selected image,
 *               or a camera-capture JPEG). EXIF is dropped on output.
 * @param maxDim Longest-edge cap in CSS pixels. Default 1080.
 * @param quality JPEG quality 0..1. Default 0.85 (target <500KB output).
 *
 * @returns A fresh image/jpeg Blob with EXIF removed and target dimensions.
 *
 * @throws If `canvas.toBlob` returns null or `createImageBitmap` rejects.
 */
export async function stripAndResize(
  input: Blob,
  maxDim = 1080,
  quality = 0.85,
): Promise<StripResult> {
  // Primary: createImageBitmap auto-orients on Safari 16.4+, Chrome 59+,
  // Firefox 98+. On older iOS Safari the option is silently ignored and
  // the bitmap is NOT auto-oriented — caught by the orientation fallback
  // below.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(input, {
      imageOrientation: 'from-image',
    })
  } catch {
    // Very old browsers throw on the options arg — fall back to no-options
    // and let the EXIF-rotate path correct it below.
    bitmap = await createImageBitmap(input)
  }

  // Compute target dimensions preserving aspect ratio.
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, maxDim / longest)
  const targetW = Math.round(bitmap.width * scale)
  const targetH = Math.round(bitmap.height * scale)

  // Defense-in-depth: read EXIF orientation. If the source had a non-trivial
  // orientation tag and createImageBitmap did NOT auto-orient (older iOS
  // Safari), apply the matching canvas transform manually before drawImage.
  // Note: when createImageBitmap successfully auto-orients, the bitmap's
  // dimensions already reflect the rotation, and re-applying the EXIF
  // transform would over-rotate. We take a conservative approach: only
  // apply the manual transform when the bitmap dimensions clearly match
  // the SENSOR orientation (i.e., un-rotated) for orientations 5-8 (which
  // swap width/height when applied). For orientations 2-4 (mirror/180)
  // the auto-orient path is reliable in practice — we still apply when
  // detected, accepting the rare double-flip edge case for older browsers.
  const orientation = await readExifOrientation(input)
  const needsManualRotate = needsManualOrientationFix(
    orientation,
    bitmap.width,
    bitmap.height,
  )

  const canvas = document.createElement('canvas')
  // When we will manually rotate by 90/270 degrees, swap canvas dimensions.
  const rotates90 =
    needsManualRotate && (orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8)
  canvas.width = rotates90 ? targetH : targetW
  canvas.height = rotates90 ? targetW : targetH

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }

  if (needsManualRotate && orientation !== undefined) {
    applyExifRotation(ctx, canvas, bitmap, orientation, targetW, targetH)
  } else {
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  }

  // Encode as JPEG. canvas.toBlob discards all metadata — this is the
  // EXIF-strip mechanism (Pitfall 5).
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!out) {
    throw new Error('canvas.toBlob returned null')
  }

  return {
    blob: out,
    width: canvas.width,
    height: canvas.height,
  }
}

/**
 * Lazy-load `exifr/dist/lite` and read just the orientation tag.
 * Returns undefined when no EXIF or unreadable.
 */
async function readExifOrientation(blob: Blob): Promise<number | undefined> {
  try {
    // Lazy import to keep exifr out of the main bundle (§Common Operation 3).
    const mod: { orientation: (input: Blob) => Promise<number | undefined> } =
      await import('exifr/dist/lite.esm.js')
    const o = await mod.orientation(blob)
    return typeof o === 'number' ? o : undefined
  } catch {
    return undefined
  }
}

/**
 * Heuristic: decide whether to apply a manual EXIF rotation transform.
 *
 * If `createImageBitmap({imageOrientation: 'from-image'})` succeeded and
 * auto-rotated, the bitmap dimensions already reflect the rotated frame;
 * we should NOT re-apply. Detection is approximate: for orientations 5-8
 * (which swap width and height), if the bitmap looks UN-swapped we infer
 * the auto-orient was a no-op and we need to rotate manually.
 *
 * For orientations 1-4 (no axis swap), we currently assume auto-orient
 * succeeded; the rare older-Safari double-flip edge case is accepted.
 */
function needsManualOrientationFix(
  orientation: number | undefined,
  bitmapW: number,
  bitmapH: number,
): boolean {
  if (!orientation || orientation < 2) return false
  // Only orientations 5-8 swap width/height. We detect "did the bitmap get
  // rotated?" by checking whether the dimensions look swapped relative to
  // expectation; since we don't have the sensor dims, we accept a simple
  // heuristic: when orientation indicates a 90/270 rotation AND the image
  // is portrait (h > w), the auto-rotate likely succeeded; when it's
  // landscape (w > h), the rotation likely did NOT happen.
  if (orientation >= 5 && orientation <= 8) {
    const looksRotated = bitmapH > bitmapW
    return !looksRotated
  }
  return false
}

/**
 * Apply the canvas transform matching the EXIF orientation tag.
 * Source: EXIF specification §4.6.5 (Orientation tag values 1-8).
 */
function applyExifRotation(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  orientation: number,
  drawW: number,
  drawH: number,
): void {
  const cw = canvas.width
  const ch = canvas.height
  switch (orientation) {
    case 2:
      // Horizontal flip
      ctx.translate(cw, 0)
      ctx.scale(-1, 1)
      break
    case 3:
      // 180° rotate
      ctx.translate(cw, ch)
      ctx.rotate(Math.PI)
      break
    case 4:
      // Vertical flip
      ctx.translate(0, ch)
      ctx.scale(1, -1)
      break
    case 5:
      // 90° CW + horizontal flip
      ctx.rotate(0.5 * Math.PI)
      ctx.scale(1, -1)
      break
    case 6:
      // 90° CW
      ctx.rotate(0.5 * Math.PI)
      ctx.translate(0, -ch)
      break
    case 7:
      // 90° CCW + horizontal flip
      ctx.rotate(-0.5 * Math.PI)
      ctx.translate(-cw, ch)
      ctx.scale(1, -1)
      break
    case 8:
      // 90° CCW
      ctx.rotate(-0.5 * Math.PI)
      ctx.translate(-cw, 0)
      break
  }
  ctx.drawImage(bitmap, 0, 0, drawW, drawH)
}
