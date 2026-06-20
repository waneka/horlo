// src/components/wywt/WristOverlaySvg.tsx
//
// Presentational overlay for the WYWT camera viewfinder. Renders a transparent
// PNG of a watch-on-arm framing guide, contained within the square viewfinder
// so the whole image stays visible regardless of stream aspect.

import Image from 'next/image'

export interface WristOverlaySvgProps {
  className?: string
}

export function WristOverlaySvg({ className }: WristOverlaySvgProps) {
  return (
    <Image
      src="/watch.png"
      alt=""
      aria-hidden="true"
      fill
      sizes="(max-width: 768px) 100vw, 600px"
      className={`object-contain scale-[1.15] ${className ?? ''}`}
    />
  )
}
