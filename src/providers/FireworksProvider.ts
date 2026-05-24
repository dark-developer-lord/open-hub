import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class FireworksProvider extends OpenAICompatProvider {
  readonly id = 'fireworks'
  readonly name = 'Fireworks AI'
  readonly models: ModelInfo[] = [
    // ── Llama 4 ───────────────────────────────────────────────────────────────
    { id: 'accounts/fireworks/models/llama4-scout-instruct-basic', name: 'Llama 4 Scout', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'accounts/fireworks/models/llama4-maverick-instruct-basic', name: 'Llama 4 Maverick', contextWindow: 131072, supportsTools: true, supportsVision: true },
    // ── Llama 3.x ─────────────────────────────────────────────────────────────
    { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'accounts/fireworks/models/llama-v3p1-405b-instruct', name: 'Llama 3.1 405B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── DeepSeek ──────────────────────────────────────────────────────────────
    { id: 'accounts/fireworks/models/deepseek-v3', name: 'DeepSeek V3', contextWindow: 65536, supportsTools: true, supportsVision: false },
    { id: 'accounts/fireworks/models/deepseek-r1', name: 'DeepSeek R1', contextWindow: 65536, supportsTools: false, supportsVision: false },
    // ── Qwen ─────────────────────────────────────────────────────────────────
    { id: 'accounts/fireworks/models/qwen3-235b-a22b', name: 'Qwen 3 235B-A22B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'accounts/fireworks/models/qwen3-30b-a3b', name: 'Qwen 3 30B-A3B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'accounts/fireworks/models/qwen2p5-72b-instruct', name: 'Qwen 2.5 72B', contextWindow: 32768, supportsTools: true, supportsVision: false },
    { id: 'accounts/fireworks/models/qwen2p5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B', contextWindow: 32768, supportsTools: true, supportsVision: true },
    // ── Mistral ───────────────────────────────────────────────────────────────
    { id: 'accounts/fireworks/models/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', contextWindow: 65536, supportsTools: true, supportsVision: false },
    { id: 'accounts/fireworks/models/mistral-7b-instruct-v0p3', name: 'Mistral 7B v0.3', contextWindow: 32768, supportsTools: true, supportsVision: false },
    // ── Google ────────────────────────────────────────────────────────────────
    { id: 'accounts/fireworks/models/gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8192, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.fireworks.ai/inference/v1')
  }
}
