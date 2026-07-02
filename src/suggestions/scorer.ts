// Re-export the Sprint 3 similarity scorer so the suggestions engine
// can use it without importing directly from the similarity module.
// Keeps the suggestions module’s dependencies explicit.
export { computeSimilarity } from '../similarity/scorer'
