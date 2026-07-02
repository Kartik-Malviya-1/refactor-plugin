import type { UIToPluginMessage } from '../../shared/messages'

export function sendToPlugin(msg: UIToPluginMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*')
}
