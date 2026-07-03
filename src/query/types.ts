import type { AuditGroup } from '../shared/types'

// ---------------------------------------------------------------------------
// Query field types
// ---------------------------------------------------------------------------

export type QueryField =
  // Typography properties
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'textCase'
  | 'textDecoration'
  // Source
  | 'source'
  | 'library'
  | 'variableCollection'
  // Usage
  | 'layerCount'
  | 'page'

export type QueryOperator =
  | 'eq'       // =
  | 'ne'       // ≠
  | 'gt'       // >
  | 'gte'      // ≥
  | 'lt'       // <
  | 'lte'      // ≤
  | 'contains' // contains (string)

export type QueryValue = string | number

export interface QueryCondition {
  id: string
  field: QueryField
  operator: QueryOperator
  value: QueryValue
  /** When false the condition is shown but excluded from evaluation. */
  enabled: boolean
}

/**
 * All conditions are ANDed together.
 * An empty conditions array matches everything.
 */
export interface QueryExpression {
  conditions: QueryCondition[]
}

// ---------------------------------------------------------------------------
// Working Set domain model
//
// First-class platform concept. Every future module (Colors, Spacing, etc.)
// produces and consumes WorkingSet<T>. Query Builder → WorkingSet<T> is the
// canonical platform pipeline after scanning.
// ---------------------------------------------------------------------------

export interface WorkingSetStatistics {
  signatureCount: number
  layerCount: number
  pageCount: number
  componentCount: number
  libraryCount: number
  variableCount: number
  /** Number of partition groups that have >1 signature (consolidation opportunities). */
  potentialConsolidations: number
  /** Signatures that could be eliminated if all consolidations are accepted. */
  estimatedReduction: number
}

export interface WorkingSet<T> {
  id: string
  name?: string
  module: 'typography' | 'colors' | 'spacing' | 'radius' | 'effects' | 'variables' | 'components'
  query: QueryExpression
  /** Typography Signatures (or domain equivalents) matching the query. */
  items: AuditGroup<T>[]
  statistics: WorkingSetStatistics
}

// ---------------------------------------------------------------------------
// Field metadata
// ---------------------------------------------------------------------------

export type QueryFieldType = 'text' | 'number' | 'enum'

export interface QueryFieldMeta {
  label: string
  type: QueryFieldType
  defaultOperator: QueryOperator
  defaultValue: QueryValue
  options?: Array<{ label: string; value: string }>  // for enum fields
}

const SOURCE_OPTIONS = [
  { label: 'Raw Values',        value: 'Raw Values' },
  { label: 'Local Text Style',  value: 'Local Text Style' },
  { label: 'Library Text Style', value: 'Library Text Style' },
  { label: 'Variable',          value: 'Variable' },
]

export const FIELD_META: Record<QueryField, QueryFieldMeta> = {
  fontFamily:         { label: 'Font Family',          type: 'text',   defaultOperator: 'eq',  defaultValue: '' },
  fontSize:           { label: 'Font Size',             type: 'number', defaultOperator: 'eq',  defaultValue: 16 },
  fontWeight:         { label: 'Font Weight',           type: 'number', defaultOperator: 'eq',  defaultValue: 400 },
  textCase:           { label: 'Text Case',             type: 'text',   defaultOperator: 'eq',  defaultValue: 'ORIGINAL' },
  textDecoration:     { label: 'Text Decoration',       type: 'text',   defaultOperator: 'eq',  defaultValue: 'NONE' },
  source:             { label: 'Source',                type: 'enum',   defaultOperator: 'eq',  defaultValue: 'Raw Values', options: SOURCE_OPTIONS },
  library:            { label: 'Library',               type: 'text',   defaultOperator: 'contains', defaultValue: '' },
  variableCollection: { label: 'Variable Collection',   type: 'text',   defaultOperator: 'contains', defaultValue: '' },
  layerCount:         { label: 'Layer Count',           type: 'number', defaultOperator: 'gte', defaultValue: 1 },
  page:               { label: 'Page',                  type: 'text',   defaultOperator: 'contains', defaultValue: '' },
}

export const OPERATOR_LABELS: Record<QueryOperator, string> = {
  eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: 'contains',
}

export const FIELD_CATEGORIES: Array<{ label: string; fields: QueryField[] }> = [
  { label: 'Typography',  fields: ['fontFamily', 'fontSize', 'fontWeight', 'textCase', 'textDecoration'] },
  { label: 'Source',      fields: ['source', 'library', 'variableCollection'] },
  { label: 'Usage',       fields: ['layerCount', 'page'] },
]
