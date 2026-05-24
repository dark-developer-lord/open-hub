import OpenAI from 'openai'
import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo, ChatOptions, ChatResponse, ContentBlock, ToolUseBlock } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export class AzureOpenAIProvider extends OpenAICompatProvider {
  readonly id = 'azure'
  readonly name = 'Azure OpenAI'
  readonly models: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-4', name: 'GPT-4', contextWindow: 8192, supportsTools: true, supportsVision: false },
    { id: 'o1', name: 'o1', contextWindow: 200000, supportsTools: false, supportsVision: true },
    { id: 'o3-mini', name: 'o3-mini', contextWindow: 200000, supportsTools: true, supportsVision: false },
  ]

  private readonly endpoint: string
  private readonly apiVersion: string

  constructor(apiKey: string, endpoint: string, apiVersion = '2024-10-21') {
    // baseURL is constructed per request from endpoint+deployment
    super(apiKey, endpoint)
    this.endpoint = endpoint
    this.apiVersion = apiVersion
    // Reinitialize client with Azure-specific options
    if (apiKey && endpoint) {
      this.client = new OpenAI({
        apiKey,
        baseURL: `${endpoint}/openai/deployments`,
        defaultQuery: { 'api-version': apiVersion },
        defaultHeaders: { 'api-key': apiKey },
      })
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.endpoint)
  }

  async chat(messages: Parameters<OpenAICompatProvider['chat']>[0], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error('Azure OpenAI endpoint/key not configured')
    // Azure uses deployment name as model in the URL path; pass model as deployment
    return super.chat(messages, options)
  }
}
