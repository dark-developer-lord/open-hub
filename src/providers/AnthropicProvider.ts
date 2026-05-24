import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider, Message, ChatOptions, ChatResponse, ModelInfo, ToolDefinition, ContentBlock } from './types.js'

export class AnthropicProvider extends BaseProvider {
  readonly id = 'anthropic'
  readonly name = 'Anthropic'
  readonly models: ModelInfo[] = [
    // ── Current lineup ──────────────────────────────────────────────────────
    { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', contextWindow: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextWindow: 200000, supportsTools: true, supportsVision: true },
    // ── Previous generation ─────────────────────────────────────────────────
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', contextWindow: 200000, supportsTools: true, supportsVision: true },
    // ── Legacy ──────────────────────────────────────────────────────────────
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (legacy)', contextWindow: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (legacy)', contextWindow: 200000, supportsTools: true, supportsVision: true },
  ]

  private client: Anthropic | null = null
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
    if (apiKey) {
      this.client = new Anthropic({ apiKey })
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error('Anthropic API key not configured')

    // Convert messages
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.convertMessage(m))

    const systemMsg = messages.find((m) => m.role === 'system')
    const system = options.system || (systemMsg ? (typeof systemMsg.content === 'string' ? systemMsg.content : '') : undefined)

    // Convert tools
    const tools = options.tools?.map((t) => this.convertTool(t))

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: options.model,
      max_tokens: options.maxTokens || 8192,
      messages: anthropicMessages,
    }

    if (system) params.system = system
    if (tools?.length) params.tools = tools
    if (options.temperature !== undefined) params.temperature = options.temperature
    if (options.toolChoice) {
      if (options.toolChoice === 'auto') params.tool_choice = { type: 'auto' }
      else if (options.toolChoice === 'none') { /* none = don't set tool_choice */ }
      else if (options.toolChoice === 'required') params.tool_choice = { type: 'any' }
      else if (typeof options.toolChoice === 'object') {
        params.tool_choice = { type: 'tool', name: options.toolChoice.name }
      }
    }

    const response = await this.client.messages.create(params)

    return {
      content: this.convertResponseContent(response.content),
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: this.mapStopReason(response.stop_reason),
    }
  }

  private convertMessage(msg: Message): Anthropic.MessageParam {
    if (typeof msg.content === 'string') {
      return { role: msg.role as 'user' | 'assistant', content: msg.content }
    }
    // Convert content blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = msg.content.map((block): any => {
      if (block.type === 'text') return { type: 'text', text: block.text }
      if (block.type === 'tool_use') {
        return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
      }
      if (block.type === 'tool_result') {
        return {
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
          is_error: block.is_error,
        }
      }
      if (block.type === 'image') {
        if (block.source.type === 'base64') {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (block.source.media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/jpeg',
              data: block.source.data || '',
            },
          }
        } else {
          return {
            type: 'image',
            source: { type: 'url', url: block.source.url || '' },
          }
        }
      }
      return { type: 'text', text: JSON.stringify(block) }
    })
    return { role: msg.role as 'user' | 'assistant', content }
  }

  private convertTool(tool: ToolDefinition): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool['input_schema'],
    }
  }

  private convertResponseContent(content: Anthropic.ContentBlock[]): ContentBlock[] {
    return content.map((block): ContentBlock => {
      if (block.type === 'text') return { type: 'text', text: block.text }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        }
      }
      return { type: 'text', text: JSON.stringify(block) }
    })
  }

  private mapStopReason(reason: string | null): ChatResponse['stopReason'] {
    if (reason === 'tool_use') return 'tool_use'
    if (reason === 'max_tokens') return 'max_tokens'
    return 'end_turn'
  }
}
