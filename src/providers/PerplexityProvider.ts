import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

export class PerplexityProvider extends OpenAICompatProvider {
  readonly id = 'perplexity'
  readonly name = 'Perplexity'
  readonly models: ModelInfo[] = [
    { id: 'sonar-pro', name: 'Sonar Pro', contextWindow: 200000, supportsTools: false, supportsVision: false },
    { id: 'sonar', name: 'Sonar', contextWindow: 127072, supportsTools: false, supportsVision: false },
    { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', contextWindow: 127072, supportsTools: false, supportsVision: false },
    { id: 'sonar-reasoning', name: 'Sonar Reasoning', contextWindow: 127072, supportsTools: false, supportsVision: false },
    { id: 'sonar-deep-research', name: 'Sonar Deep Research', contextWindow: 127072, supportsTools: false, supportsVision: false },
    { id: 'r1-1776', name: 'R1-1776', contextWindow: 127072, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://api.perplexity.ai')
  }
}
