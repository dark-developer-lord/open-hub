import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class DeepSeekProvider extends OpenAICompatProvider {
  readonly id = 'deepseek'
  readonly name = 'DeepSeek'
  readonly models: ModelInfo[] = [
    // ── Current V4 API models ──────────────────────────────────────────────────
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── V3 series ─────────────────────────────────────────────────────────────
    { id: 'deepseek-v3-2-exp', name: 'DeepSeek V3.2 Exp', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek-v3-2', name: 'DeepSeek V3.2', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek-v3-1', name: 'DeepSeek V3.1', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek-v3-0324', name: 'DeepSeek V3-0324', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek-v3', name: 'DeepSeek V3', contextWindow: 65536, supportsTools: true, supportsVision: false },
    // ── R1 reasoning series ───────────────────────────────────────────────────
    { id: 'deepseek-r1-0528', name: 'DeepSeek R1-0528', contextWindow: 65536, supportsTools: false, supportsVision: false },
    { id: 'deepseek-r1', name: 'DeepSeek R1', contextWindow: 65536, supportsTools: false, supportsVision: false },
    // ── Legacy aliases (future deprecated) ────────────────────────────────────
    { id: 'deepseek-chat', name: 'deepseek-chat (→ V4 Flash)', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'deepseek-reasoner', name: 'deepseek-reasoner (→ V4 Flash thinking)', contextWindow: 131072, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.deepseek.com/v1')
  }
}
