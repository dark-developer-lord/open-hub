import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'
import type { CustomProviderConfig } from '../config/Config.js'

/**
 * A fully dynamic OpenAI-compatible provider built from a runtime config object.
 * Used for any OpenAI-compatible API endpoint added via config or env vars.
 */
export class CustomProvider extends OpenAICompatProvider {
  readonly id: string
  readonly name: string
  readonly models: ModelInfo[]
  private readonly _allowEmptyKey: boolean

  constructor(cfg: CustomProviderConfig) {
    super(cfg.apiKey || '', cfg.baseURL)
    this.id = cfg.id
    this.name = cfg.name
    this._allowEmptyKey = cfg.allowEmptyKey ?? true

    if (cfg.models && cfg.models.length > 0) {
      this.models = cfg.models.map((m) => ({
        id: m.id,
        name: m.name,
        contextWindow: m.contextWindow ?? 128000,
        supportsTools: m.supportsTools ?? true,
        supportsVision: m.supportsVision ?? false,
      }))
    } else {
      // No models defined — expose a generic "default" model so the provider is usable
      this.models = [
        {
          id: 'default',
          name: 'Default',
          contextWindow: 128000,
          supportsTools: true,
          supportsVision: false,
        },
      ]
    }
  }

  protected allowEmptyKey(): boolean {
    return this._allowEmptyKey
  }
}
