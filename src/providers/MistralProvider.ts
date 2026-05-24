import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class MistralProvider extends OpenAICompatProvider {
  readonly id = 'mistral'
  readonly name = 'Mistral AI'
  readonly models: ModelInfo[] = [
    // ── Flagship ──────────────────────────────────────────────────────────────
    { id: 'mistral-large-3', name: 'Mistral Large 3', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Medium series ─────────────────────────────────────────────────────────
    { id: 'mistral-medium-3-5', name: 'Mistral Medium 3.5', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'mistral-medium-3-1', name: 'Mistral Medium 3.1', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'mistral-medium-3', name: 'Mistral Medium 3', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Small series ──────────────────────────────────────────────────────────
    { id: 'mistral-small-4', name: 'Mistral Small 4', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'mistral-small-latest', name: 'Mistral Small (latest)', contextWindow: 32768, supportsTools: true, supportsVision: false },
    // ── Code ─────────────────────────────────────────────────────────────────
    { id: 'codestral-latest', name: 'Codestral (latest)', contextWindow: 256000, supportsTools: true, supportsVision: false },
    { id: 'devstral-medium-2', name: 'Devstral Medium 2', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'devstral-small', name: 'Devstral Small', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Reasoning (Magistral) ─────────────────────────────────────────────────
    { id: 'magistral-medium-latest', name: 'Magistral Medium', contextWindow: 40960, supportsTools: false, supportsVision: false },
    { id: 'magistral-small-latest', name: 'Magistral Small', contextWindow: 40960, supportsTools: false, supportsVision: false },
    // ── Vision (Pixtral) ──────────────────────────────────────────────────────
    { id: 'pixtral-large-latest', name: 'Pixtral Large', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'pixtral-12b-2409', name: 'Pixtral 12B', contextWindow: 131072, supportsTools: true, supportsVision: true },
    // ── Edge (Ministral) ──────────────────────────────────────────────────────
    { id: 'ministral-8b-latest', name: 'Ministral 8B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'ministral-3b-latest', name: 'Ministral 3B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Open-weight / legacy ──────────────────────────────────────────────────
    { id: 'mistral-nemo', name: 'Mistral Nemo 12B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B (legacy)', contextWindow: 65536, supportsTools: true, supportsVision: false },
    { id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B (legacy)', contextWindow: 32768, supportsTools: false, supportsVision: false },
    { id: 'open-mistral-7b', name: 'Mistral 7B (legacy)', contextWindow: 32768, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.mistral.ai/v1')
  }
}
