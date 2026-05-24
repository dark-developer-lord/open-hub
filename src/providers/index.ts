import { BaseProvider, ModelInfo } from './types.js'
import { AnthropicProvider } from './AnthropicProvider.js'
import { OpenAIProvider } from './OpenAIProvider.js'
import { GeminiProvider } from './GeminiProvider.js'
import { GroqProvider } from './GroqProvider.js'
import { MistralProvider } from './MistralProvider.js'
import { XAIProvider } from './XAIProvider.js'
import { PerplexityProvider } from './PerplexityProvider.js'
import { DeepSeekProvider } from './DeepSeekProvider.js'
import { TogetherProvider } from './TogetherProvider.js'
import { FireworksProvider } from './FireworksProvider.js'
import { CerebrasProvider } from './CerebrasProvider.js'
import { OllamaProvider } from './OllamaProvider.js'
import { CohereProvider } from './CohereProvider.js'
import { AzureOpenAIProvider } from './AzureOpenAIProvider.js'
import { NovitaProvider } from './NovitaProvider.js'
import { QwenProvider } from './QwenProvider.js'
import { CustomProvider } from './CustomProvider.js'
import config from '../config/Config.js'
import type { CustomProviderConfig } from '../config/Config.js'

export * from './types.js'
export {
  AnthropicProvider, OpenAIProvider, GeminiProvider, GroqProvider,
  MistralProvider, XAIProvider, PerplexityProvider, DeepSeekProvider,
  TogetherProvider, FireworksProvider, CerebrasProvider, OllamaProvider,
  CohereProvider, AzureOpenAIProvider, NovitaProvider, QwenProvider, CustomProvider,
}

/**
 * Scans environment variables for dynamically declared custom providers.
 * Pattern: PROVIDER_<ID>_BASE_URL (required)
 *          PROVIDER_<ID>_API_KEY  (optional)
 *          PROVIDER_<ID>_NAME     (optional, defaults to ID)
 *          PROVIDER_<ID>_MODELS   (optional, comma-separated model IDs)
 *          PROVIDER_<ID>_ALLOW_EMPTY_KEY (optional, "true" to skip key requirement)
 */
function loadEnvCustomProviders(): CustomProviderConfig[] {
  const providers: CustomProviderConfig[] = []
  const seen = new Set<string>()

  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^PROVIDER_([A-Z0-9_]+)_BASE_URL$/i)
    if (match && value) {
      const envId = match[1]
      const id = envId.toLowerCase().replace(/_/g, '-')
      if (seen.has(id)) continue
      seen.add(id)

      const apiKey = process.env[`PROVIDER_${envId}_API_KEY`] || ''
      const name = process.env[`PROVIDER_${envId}_NAME`] || id
      const allowEmptyStr = process.env[`PROVIDER_${envId}_ALLOW_EMPTY_KEY`] || ''
      const allowEmptyKey = allowEmptyStr.toLowerCase() === 'true' || !apiKey
      const modelsStr = process.env[`PROVIDER_${envId}_MODELS`] || ''
      const models = modelsStr
        ? modelsStr.split(',').map((m) => m.trim()).filter(Boolean).map((m) => ({
            id: m,
            name: m,
            contextWindow: 128000,
          }))
        : []

      providers.push({ id, name, baseURL: value, apiKey, allowEmptyKey, models })
    }
  }

  return providers
}

export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map()
  private currentProvider: string
  private currentModel: string

  constructor() {
    const cfg = config.get()
    this.currentProvider = cfg.defaults.provider
    this.currentModel = cfg.defaults.model
    this.initProviders()
  }

  private initProviders() {
    const cfg = config.get()
    const p = cfg.providers
    this.providers.set('anthropic', new AnthropicProvider(p.anthropic?.apiKey || ''))
    this.providers.set('openai', new OpenAIProvider(p.openai?.apiKey || ''))
    this.providers.set('google', new GeminiProvider(p.google?.apiKey || ''))
    this.providers.set('groq', new GroqProvider(p.groq?.apiKey || ''))
    this.providers.set('mistral', new MistralProvider(p.mistral?.apiKey || ''))
    this.providers.set('xai', new XAIProvider(p.xai?.apiKey || ''))
    this.providers.set('perplexity', new PerplexityProvider(p.perplexity?.apiKey || ''))
    this.providers.set('deepseek', new DeepSeekProvider(p.deepseek?.apiKey || ''))
    this.providers.set('together', new TogetherProvider(p.together?.apiKey || ''))
    this.providers.set('fireworks', new FireworksProvider(p.fireworks?.apiKey || ''))
    this.providers.set('cerebras', new CerebrasProvider(p.cerebras?.apiKey || ''))
    this.providers.set('ollama', new OllamaProvider(p.ollama?.host))
    this.providers.set('cohere', new CohereProvider(p.cohere?.apiKey || ''))
    this.providers.set('novita', new NovitaProvider(p.novita?.apiKey || ''))
    this.providers.set('qwen', new QwenProvider(p.qwen?.apiKey || ''))
    this.providers.set('azure', new AzureOpenAIProvider(
      p.azure?.apiKey || '',
      p.azure?.endpoint || '',
      p.azure?.apiVersion,
    ))

    // Auto-register custom providers from config file
    const customFromConfig = cfg.customProviders || []
    for (const cp of customFromConfig) {
      if (!this.providers.has(cp.id)) {
        this.providers.set(cp.id, new CustomProvider(cp))
      }
    }

    // Auto-register custom providers from environment variables
    const envProviders = loadEnvCustomProviders()
    for (const cp of envProviders) {
      if (!this.providers.has(cp.id)) {
        this.providers.set(cp.id, new CustomProvider(cp))
      }
    }
  }

  getProvider(providerId?: string): BaseProvider {
    const id = providerId || this.currentProvider
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Provider '${id}' not found`)
    return provider
  }

  getCurrentProvider(): BaseProvider {
    return this.getProvider(this.currentProvider)
  }

  getCurrentModel(): string {
    return this.currentModel
  }

  setProvider(providerId: string, model?: string) {
    const provider = this.providers.get(providerId)
    if (!provider) throw new Error(`Provider '${providerId}' not found. Available: ${this.listProviders().join(', ')}`)
    this.currentProvider = providerId
    this.currentModel = model || provider.getDefaultModel()
  }

  setModel(modelId: string) {
    // Find which provider has this model
    for (const [id, provider] of this.providers.entries()) {
      const model = provider.getModel(modelId)
      if (model) {
        this.currentProvider = id
        this.currentModel = model.id
        return model
      }
    }
    // If not found in any provider, just set it on current provider
    this.currentModel = modelId
    return null
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  listConfiguredProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, p]) => p.isConfigured())
      .map(([id]) => id)
  }

  getAllModels(): Array<ModelInfo & { provider: string }> {
    const models: Array<ModelInfo & { provider: string }> = []
    for (const [id, provider] of this.providers.entries()) {
      if (provider.isConfigured()) {
        for (const model of provider.models) {
          models.push({ ...model, provider: id })
        }
      }
    }
    return models
  }

  getCurrentProviderId(): string {
    return this.currentProvider
  }

  getStatus(): string {
    const provider = this.getCurrentProvider()
    return `${provider.name} / ${this.currentModel}`
  }

  /** Re-init providers from config but keep current selection. */
  refreshProviders() {
    const curProvider = this.currentProvider
    const curModel = this.currentModel
    this.initProviders()
    // Restore selection instead of reverting to config defaults
    try {
      if (this.providers.has(curProvider)) {
        this.currentProvider = curProvider
        this.currentModel = curModel
      }
    } catch {
      // keep whatever initProviders set
    }
  }

  refreshFromConfig() {
    this.initProviders()
    const cfg = config.get()
    this.currentProvider = cfg.defaults.provider
    this.currentModel = cfg.defaults.model
  }

  getProvidersInfo(): Array<{
    id: string
    name: string
    configured: boolean
    keyMasked?: string
    models: Array<{ id: string; name: string }>
  }> {
    const cfg = config.get()
    const result: Array<{
      id: string; name: string; configured: boolean; keyMasked?: string
      models: Array<{ id: string; name: string }>
    }> = []
    for (const [id, provider] of this.providers.entries()) {
      const provCfg = (cfg.providers as Record<string, { apiKey?: string } | undefined>)[id]
      let keyMasked: string | undefined
      if (provCfg?.apiKey) {
        const key = provCfg.apiKey
        keyMasked = key.length > 8 ? key.slice(0, 4) + '…' + key.slice(-4) : '****'
      }
      result.push({
        id,
        name: provider.name,
        configured: provider.isConfigured(),
        keyMasked,
        models: provider.models.map(m => ({ id: m.id, name: m.name })),
      })
    }
    return result
  }
}

export const providerRegistry = new ProviderRegistry()
