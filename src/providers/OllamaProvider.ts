import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class OllamaProvider extends OpenAICompatProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama (local)'
  readonly models: ModelInfo[] = [
    // ── Llama ─────────────────────────────────────────────────────────────────
    { id: 'llama4', name: 'Llama 4 Scout', contextWindow: 10485760, supportsTools: true, supportsVision: true },
    { id: 'llama3.3', name: 'Llama 3.3 70B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'llama3.2-vision', name: 'Llama 3.2 Vision', contextWindow: 131072, supportsTools: false, supportsVision: true },
    { id: 'llama3.1', name: 'Llama 3.1 8B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── DeepSeek ──────────────────────────────────────────────────────────────
    { id: 'deepseek-v3', name: 'DeepSeek V3', contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'deepseek-r1', name: 'DeepSeek R1', contextWindow: 131072, supportsTools: false, supportsVision: false },
    // ── Qwen ─────────────────────────────────────────────────────────────────
    { id: 'qwen3', name: 'Qwen 3 (latest)', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'qwen3:235b', name: 'Qwen 3 235B', contextWindow: 40960, supportsTools: true, supportsVision: false },
    { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', contextWindow: 32768, supportsTools: true, supportsVision: false },
    { id: 'qwen2.5vl', name: 'Qwen 2.5 VL', contextWindow: 32768, supportsTools: false, supportsVision: true },
    // ── Gemma ─────────────────────────────────────────────────────────────────
    { id: 'gemma3', name: 'Gemma 3 (latest)', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'gemma3n', name: 'Gemma 3n', contextWindow: 131072, supportsTools: false, supportsVision: true },
    // ── Mistral ───────────────────────────────────────────────────────────────
    { id: 'mistral', name: 'Mistral 7B', contextWindow: 32768, supportsTools: true, supportsVision: false },
    { id: 'mistral-nemo', name: 'Mistral Nemo 12B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'devstral', name: 'Devstral', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Microsoft ─────────────────────────────────────────────────────────────
    { id: 'phi4', name: 'Phi-4', contextWindow: 16384, supportsTools: true, supportsVision: false },
    { id: 'phi4-mini', name: 'Phi-4 Mini', contextWindow: 16384, supportsTools: true, supportsVision: false },
    // ── Coding ────────────────────────────────────────────────────────────────
    { id: 'codellama', name: 'Code Llama', contextWindow: 16384, supportsTools: false, supportsVision: false },
    // ── Embeddings ────────────────────────────────────────────────────────────
    { id: 'nomic-embed-text', name: 'Nomic Embed Text', contextWindow: 8192, supportsTools: false, supportsVision: false },
    { id: 'mxbai-embed-large', name: 'MxBAI Embed Large', contextWindow: 512, supportsTools: false, supportsVision: false },
  ]

  constructor(host?: string) {
    super('', `${host || process.env.OLLAMA_HOST || 'http://localhost:11434'}/v1`)
  }

  protected override allowEmptyKey(): boolean {
    return true
  }
}
