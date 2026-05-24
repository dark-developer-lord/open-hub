import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class TogetherProvider extends OpenAICompatProvider {
  readonly id = 'together'
  readonly name = 'Together AI'
  readonly models: ModelInfo[] = [
    // ── Llama 4 ───────────────────────────────────────────────────────────────
    { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', name: 'Llama 4 Scout 17B', contextWindow: 10485760, supportsTools: true, supportsVision: true },
    { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', name: 'Llama 4 Maverick 17B', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    // ── Llama 3.x ─────────────────────────────────────────────────────────────
    { id: 'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B Turbo', contextWindow: 130815, supportsTools: true, supportsVision: false },
    { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B Turbo', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── DeepSeek ──────────────────────────────────────────────────────────────
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', contextWindow: 65536, supportsTools: true, supportsVision: false },
    { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', contextWindow: 65536, supportsTools: false, supportsVision: false },
    // ── Qwen ─────────────────────────────────────────────────────────────────
    { id: 'Qwen/Qwen3-235B-A22B-Instruct-FP8', name: 'Qwen 3 235B-A22B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'Qwen/Qwen3-72B-Instruct-Turbo', name: 'Qwen 3 72B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'Qwen/Qwen3-30B-A3B-Instruct-FP8', name: 'Qwen 3 30B-A3B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', contextWindow: 32768, supportsTools: true, supportsVision: false },
    { id: 'Qwen/Qwen2.5-VL-72B-Instruct', name: 'Qwen 2.5 VL 72B', contextWindow: 32768, supportsTools: true, supportsVision: true },
    { id: 'Qwen/QwQ-32B', name: 'QwQ 32B', contextWindow: 32768, supportsTools: true, supportsVision: false },
    // ── Mistral ───────────────────────────────────────────────────────────────
    { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B', contextWindow: 65536, supportsTools: true, supportsVision: false },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3', contextWindow: 32768, supportsTools: true, supportsVision: false },
    // ── Google ────────────────────────────────────────────────────────────────
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', contextWindow: 131072, supportsTools: false, supportsVision: true },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', contextWindow: 8192, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.together.xyz/v1')
  }
}
