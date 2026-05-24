import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class CohereProvider extends OpenAICompatProvider {
  readonly id = 'cohere'
  readonly name = 'Cohere'
  readonly models: ModelInfo[] = [
    // ── Current ───────────────────────────────────────────────────────────────
    { id: 'command-a-plus', name: 'Command A+', contextWindow: 256000, supportsTools: true, supportsVision: false },
    { id: 'command-a-03-2025', name: 'Command A', contextWindow: 256000, supportsTools: true, supportsVision: false },
    // ── Command R series ──────────────────────────────────────────────────────
    { id: 'command-r-plus-08-2024', name: 'Command R+ (08-2024)', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'command-r-08-2024', name: 'Command R (08-2024)', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'command-r7b-12-2024', name: 'Command R7B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    // ── Aya multilingual ──────────────────────────────────────────────────────
    { id: 'aya-expanse-32b', name: 'Aya Expanse 32B', contextWindow: 128000, supportsTools: false, supportsVision: false },
    { id: 'aya-expanse-8b', name: 'Aya Expanse 8B', contextWindow: 128000, supportsTools: false, supportsVision: false },
    { id: 'aya-vision-32b', name: 'Aya Vision 32B', contextWindow: 128000, supportsTools: false, supportsVision: true },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.cohere.ai/compatibility/v1')
  }
}
