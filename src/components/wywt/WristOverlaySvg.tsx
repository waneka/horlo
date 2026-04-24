// src/components/wywt/WristOverlaySvg.tsx
//
// Pure presentational SVG overlay for the WYWT camera viewfinder.
//
// References:
// - 15-UI-SPEC.md §CameraCaptureView + WristOverlaySvg (geometry contract)
// - 15-CONTEXT.md D-08 — overlay shapes (arm lines + concentric circles +
//   hands at 10:10 + crown at 3 o'clock); user-clarified during the
//   discussion on 2026-04-24, reference at
//   .planning/phases/15-wywt-photo-post-flow/assets/overlay-reference.png
//
// Geometry (viewBox=0 0 100 100, percentage units):
// - Arm: two horizontal lines at y=38 and y=62 spanning full width
// - Watch: two concentric circles centered at (50,50) — outer r=22, inner r=17
// - Hands at 10:10 — hour hand to 10 o'clock, minute hand to 2 o'clock
// - Crown: small rect at (72,49) w=4 h=3
// Nothing else: NO hour markers, NO lugs, NO strap edges, NO bracelet pattern.

export interface WristOverlaySvgProps {
  className?: string
}

export function WristOverlaySvg({ className }: WristOverlaySvgProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="rgba(255,255,255,0.85)"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {/* Arm edges — horizontal lines spanning full width */}
      <line x1="0" y1="38" x2="100" y2="38" />
      <line x1="0" y1="62" x2="100" y2="62" />
      {/* Watch — outer (bezel) + inner (face) concentric circles */}
      <circle cx="50" cy="50" r="22" />
      <circle cx="50" cy="50" r="17" />
      {/* Hands at 10:10 — hour to "10", minute to "2" */}
      <line x1="50" y1="50" x2="38" y2="27" />
      <line x1="50" y1="50" x2="62" y2="27" />
      {/* Crown at 3 o'clock — small filled rect */}
      <rect
        x="72"
        y="49"
        width="4"
        height="3"
        fill="rgba(255,255,255,0.85)"
        stroke="none"
      />
    </svg>
  )
}
