import { memo } from 'react'
import type { TypographyProperties } from '../../../modules/typography/types'
import { cn } from '../../lib/cn'

interface TypographyPreviewProps {
  properties: TypographyProperties
  className?: string
}

const textCaseMap: Record<string, string> = {
  UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize',
  SMALL_CAPS: 'uppercase', SMALL_CAPS_FORCED: 'uppercase', ORIGINAL: 'none',
}

// memo: only re-renders when properties or className reference changes.
// Since TypographyProperties are interned strings, reference equality holds
// for groups whose descriptor has not changed.
export const TypographyPreview = memo(function TypographyPreview({ properties, className }: TypographyPreviewProps) {
  const { fontFamily, fontSize, lineHeight, letterSpacing, textDecoration, textCase } = properties
  const lhPx = lineHeight.unit === 'AUTO' ? undefined : lineHeight.unit === 'PIXELS' ? `${lineHeight.value}px` : `${lineHeight.value}%`
  const lsPx = letterSpacing.unit === 'PIXELS' ? `${letterSpacing.value}px` : `${letterSpacing.value / 100}em`
  const clampedSize = Math.min(fontSize, 14)

  return (
    <div className={cn('flex items-center justify-center overflow-hidden', className)}>
      <span
        style={{
          fontFamily: `"${fontFamily}", sans-serif`,
          fontWeight: properties.fontWeight,
          fontSize: `${clampedSize}px`,
          lineHeight: lhPx ?? 'normal',
          letterSpacing: lsPx,
          textDecoration: textDecoration === 'UNDERLINE' ? 'underline' : textDecoration === 'STRIKETHROUGH' ? 'line-through' : 'none',
          textTransform: (textCaseMap[textCase] ?? 'none') as React.CSSProperties['textTransform'],
          whiteSpace: 'nowrap',
          color: 'var(--ink)',
        }}
      >
        Ag
      </span>
    </div>
  )
})
