// Shared listener registry for the Usage Explorer notification.
// Separated to avoid require() cycles inside usePluginMessage.ts.
export const _usageExplorerListeners: Array<() => void> = []
