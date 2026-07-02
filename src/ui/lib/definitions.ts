// ---------------------------------------------------------------------------
// Platform Terminology Definitions
//
// Canonical definitions for every major concept in the Refactor platform.
// Used by InfoButton popovers across all workspaces and modules.
// Every future module should add its definitions here rather than
// defining terms inline.
// ---------------------------------------------------------------------------

export interface TermDefinition {
  term: string
  description: string
  properties?: string[]
  note?: string
}

export const DEFINITIONS = {
  typographySignature: {
    term: 'Typography Signature',
    description:
      'A unique combination of typography properties found in the document. ' +
      'Every text layer belongs to exactly one Typography Signature.',
    properties: [
      'Font Family',
      'Font Size',
      'Font Weight',
      'Line Height',
      'Letter Spacing',
      'Text Case',
      'Text Decoration',
    ],
  } satisfies TermDefinition,

  source: {
    term: 'Source',
    description: 'The origin of a typography definition.',
    properties: [
      'Raw Values — defined directly on the layer',
      'Local Text Style — uses a style from this file',
      'Library Text Style — uses a style from a shared library',
      'Variable — bound to a typography variable',
      'Unknown — source could not be determined',
    ],
    note: 'Source is never inferred. If it cannot be determined with confidence it is shown as Unknown.',
  } satisfies TermDefinition,

  migrationPlan: {
    term: 'Migration Plan',
    description:
      'The complete collection of approved mappings that will eventually be applied to the document.',
    note: 'Nothing changes in the document until a Migration Plan has been reviewed and approved.',
  } satisfies TermDefinition,
} as const
