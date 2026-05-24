import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class XAIProvider extends OpenAICompatProvider {
  readonly id = 'xai'
  readonly name = 'xAI (Grok)'
  readonly models: ModelInfo[] = [
    // ── Current frontier ──────────────────────────────────────────────────────
    { id: 'grok-4.3', name: 'Grok 4.3', contextWindow: 256000, supportsTools: true, supportsVision: true },
    { id: 'grok-4', name: 'Grok 4', contextWindow: 256000, supportsTools: true, supportsVision: true },
    // ── Grok 3 series ─────────────────────────────────────────────────────────
    { id: 'grok-3', name: 'Grok 3', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'grok-3-fast', name: 'Grok 3 Fast', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Vision ────────────────────────────────────────────────────────────────
    { id: 'grok-2-vision-1212', name: 'Grok 2 Vision (legacy)', contextWindow: 32768, supportsTools: true, supportsVision: true },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.x.ai/v1')
  }
}
