// Core types shared across providers and tools

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
  /** DeepSeek-R1 / thinking-mode: must be echoed back to the API */
  reasoning_content?: string
}

export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlock[]
  is_error?: boolean
}

export interface ImageBlock {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    media_type?: string
    data?: string
    url?: string
  }
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ChatOptions {
  model: string
  maxTokens?: number
  temperature?: number
  system?: string
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; name: string }
}

export interface ChatResponse {
  content: ContentBlock[]
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  /** DeepSeek-R1 thinking content — must be stored and echoed back */
  reasoning_content?: string
}

export interface ProviderInfo {
  name: string
  id: string
  models: ModelInfo[]
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  supportsTools: boolean
  supportsVision: boolean
}

export abstract class BaseProvider {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly models: ModelInfo[]

  abstract isConfigured(): boolean

  abstract chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>

  getDefaultModel(): string {
    return this.models[0]?.id || ''
  }

  getModel(modelId: string): ModelInfo | undefined {
    return this.models.find((m) => m.id === modelId || m.id.includes(modelId))
  }

  extractText(response: ChatResponse): string {
    return response.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
  }

  extractToolCalls(response: ChatResponse): ToolUseBlock[] {
    return response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
  }
}
