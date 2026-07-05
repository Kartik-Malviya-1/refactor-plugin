import type { TypographyProperties } from '../modules/typography/types'
import type { AssignedTarget } from '../clustering/types'

export type ReviewStatus = 'unread' | 'reviewed' | 'needs-attention' | 'skipped' | 'accepted'

export interface LayerChange {
  layerId:      string
  layerName:    string
  signatureKey: string
  current:      TypographyProperties
  planned:      AssignedTarget
}

export interface ReviewItem {
  id:          string   // `${pageId}__${frameName}`
  pageId:      string
  pageName:    string
  frameName:   string
  changes:     LayerChange[]
  changeCount: number
}
