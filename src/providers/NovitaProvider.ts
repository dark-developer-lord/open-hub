import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class NovitaProvider extends OpenAICompatProvider {
  readonly id = 'novita'
  readonly name = 'Novita AI'
  readonly models: ModelInfo[] = [
    // ── Llama 4 ───────────────────────────────────────────────────────────────
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', contextWindow: 131072, supportsTools: true, supportsVision: true },
    // ── Llama 3.x ─────────────────────────────────────────────────────────────
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── DeepSeek ──────────────────────────────────────────────────────────────
    { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', contextWindow: 131072, supportsTools: false, supportsVision: false },
    // ── Qwen ─────────────────────────────────────────────────────────────────
    { id: 'qwen/qwen3-235b-a22b', name: 'Qwen 3 235B-A22B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'qwen/qwen3-30b-a3b', name: 'Qwen 3 30B-A3B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', contextWindow: 32768, supportsTools: true, supportsVision: false },
    { id: 'qwen/qwen2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B', contextWindow: 32768, supportsTools: false, supportsVision: true },
    // ── Mistral ───────────────────────────────────────────────────────────────
    { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo 12B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', contextWindow: 32768, supportsTools: true, supportsVision: false },
    // ── Google ────────────────────────────────────────────────────────────────
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', contextWindow: 131072, supportsTools: false, supportsVision: true },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', contextWindow: 8192, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.novita.ai/v3/openai')
  }
}
