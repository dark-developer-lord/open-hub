import OpenAI from 'openai'
import { BaseProvider, Message, ChatOptions, ChatResponse, ModelInfo, ToolDefinition, ContentBlock, ToolUseBlock } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI'
  readonly models: ModelInfo[] = [
    // ── Frontier ─────────────────────────────────────────────────────────────
    { id: 'gpt-5-5', name: 'GPT-5.5', contextWindow: 256000, supportsTools: true, supportsVision: true },
    { id: 'gpt-5-2', name: 'GPT-5.2', contextWindow: 256000, supportsTools: true, supportsVision: true },
    { id: 'gpt-5-1', name: 'GPT-5.1', contextWindow: 256000, supportsTools: true, supportsVision: true },
    { id: 'gpt-5', name: 'GPT-5', contextWindow: 256000, supportsTools: true, supportsVision: true },
    { id: 'gpt-5-1-codex-max', name: 'GPT-5.1 Codex Max', contextWindow: 256000, supportsTools: true, supportsVision: false },
    // ── GPT-4.x series ───────────────────────────────────────────────────────
    { id: 'gpt-4.5', name: 'GPT-4.5', contextWindow: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576, supportsTools: true, supportsVision: true },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1047576, supportsTools: true, supportsVision: true },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', contextWindow: 1047576, supportsTools: true, supportsVision: true },
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsTools: true, supportsVision: true },
    // ── o-series (reasoning) ──────────────────────────────────────────────────
    { id: 'o4-mini', name: 'o4-mini', contextWindow: 200000, supportsTools: true, supportsVision: true },
    { id: 'o3', name: 'o3', contextWindow: 200000, supportsTools: true, supportsVision: true },
    // ── Open-weight ───────────────────────────────────────────────────────────
    { id: 'gpt-oss-120b', name: 'GPT OSS 120B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'gpt-oss-20b', name: 'GPT OSS 20B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    // ── Legacy ────────────────────────────────────────────────────────────────
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (legacy)', contextWindow: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (legacy)', contextWindow: 16384, supportsTools: true, supportsVision: false },
  ]

  private client: OpenAI | null = null
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
    if (apiKey) {
      this.client = new OpenAI({ apiKey })
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error('OpenAI API key not configured')

    const openAIMessages = messages.map((m) => this.convertMessage(m))
    const tools = options.tools?.map((t) => this.convertTool(t))

    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: options.model,
      messages: openAIMessages,
      max_tokens: options.maxTokens,
    }

    if (tools?.length) params.tools = tools
    if (options.temperature !== undefined) params.temperature = options.temperature

    const response = await this.client.chat.completions.create(params)
    const choice = response.choices[0]

    const content: ContentBlock[] = []

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content })
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id || uuidv4(),
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        } as ToolUseBlock)
      }
    }

    return {
      content,
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      stopReason: this.mapFinishReason(choice.finish_reason),
    }
  }

  private convertMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
    if (typeof msg.content === 'string') {
      return { role: msg.role as 'user' | 'assistant' | 'system', content: msg.content }
    }

    // Convert blocks to OpenAI format
    const textBlocks = msg.content.filter((b) => b.type === 'text')
    const toolResults = msg.content.filter((b) => b.type === 'tool_result')
    const toolUses = msg.content.filter((b) => b.type === 'tool_use')

    if (toolResults.length > 0) {
      return {
        role: 'tool',
        tool_call_id: (msg.content[0] as { type: 'tool_result'; tool_use_id: string }).tool_use_id || '',
        content: textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('') || JSON.stringify(msg.content),
      } as OpenAI.ChatCompletionToolMessageParam
    }

    if (toolUses.length > 0 && msg.role === 'assistant') {
      return {
        role: 'assistant',
        content: textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('') || null,
        tool_calls: toolUses.map((b) => {
          const tu = b as ToolUseBlock
          return {
            id: tu.id,
            type: 'function' as const,
            function: { name: tu.name, arguments: JSON.stringify(tu.input) },
          }
        }),
      }
    }

    const text = textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('')
    return { role: msg.role as 'user' | 'assistant' | 'system', content: text }
  }

  private convertTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }
  }

  private mapFinishReason(reason: string | null): ChatResponse['stopReason'] {
    if (reason === 'tool_calls') return 'tool_use'
    if (reason === 'length') return 'max_tokens'
    return 'end_turn'
  }
}
