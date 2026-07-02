import type { ScannerAdapter } from '../../engine/types'
import type { TypographyProperties } from './types'
import { extractProperties } from './scanner'
import { normalizeTypographyProps } from './normalizer'

// ---------------------------------------------------------------------------
// Typography Scanner Adapter
//
// The only file in the codebase that knows both about TextNode (Figma API)
// and TypographyProperties (domain type). The Core Scan Engine never sees
// either — it receives only this adapter.
//
// To add a Colors module: create ColorsScannerAdapter following this exact
// shape. No engine changes required.
// ---------------------------------------------------------------------------

export const typographyScannerAdapter: ScannerAdapter<TextNode, TypographyProperties> = {
  moduleId: 'typography',

  accepts(node: BaseNode): node is TextNode {
    return node.type === 'TEXT'
  },

  extract(node: TextNode): TypographyProperties | null {
    return extractProperties(node)
  },

  normalize(properties: TypographyProperties): string {
    return normalizeTypographyProps(properties)
  },

  describe(properties: TypographyProperties): string {
    return `${properties.fontFamily} ${properties.fontStyle} / ${properties.fontSize}px`
  },
}
