import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class CerebrasProvider extends OpenAICompatProvider {
  readonly id = 'cerebras'
  readonly name = 'Cerebras'
  readonly models: ModelInfo[] = [
    // ── Llama 4 ───────────────────────────────────────────────────────────────
    { id: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Llama 3.x ─────────────────────────────────────────────────────────────
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'llama3.1-70b', name: 'Llama 3.1 70B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'llama3.1-8b', name: 'Llama 3.1 8B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Reasoning ─────────────────────────────────────────────────────────────
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen-3-32b', name: 'Qwen 3 32B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'qwen-3-235b-a22b', name: 'Qwen 3 235B-A22B', contextWindow: 131072, supportsTools: true, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.cerebras.ai/v1')
  }
}
