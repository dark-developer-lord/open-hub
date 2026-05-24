/**
 * Base class for any OpenAI-compatible REST API.
 * Subclasses only need to set id, name, models, and pass baseURL + apiKey.
 */
import OpenAI from 'openai'
import { BaseProvider, Message, ChatOptions, ChatResponse, ModelInfo, ToolDefinition, ContentBlock, ToolUseBlock } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export abstract class OpenAICompatProvider extends BaseProvider {
  protected client: OpenAI | null = null
  protected apiKey: string
  protected baseURL: string

  constructor(apiKey: string, baseURL: string) {
    super()
    this.apiKey = apiKey
    this.baseURL = baseURL
    if (apiKey || this.allowEmptyKey()) {
      this.client = new OpenAI({ apiKey: apiKey || 'ollama', baseURL })
    }
  }

  /** Override to true for providers that don't require an API key (e.g. Ollama). */
  protected allowEmptyKey(): boolean {
    return false
  }

  isConfigured(): boolean {
    return !!(this.apiKey || this.allowEmptyKey())
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error(`${this.name} API key not configured`)

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

  protected convertMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
    if (typeof msg.content === 'string') {
      return { role: msg.role as 'user' | 'assistant' | 'system', content: msg.content }
    }

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

  protected convertTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }
  }

  protected mapFinishReason(reason: string | null): ChatResponse['stopReason'] {
    if (reason === 'tool_calls') return 'tool_use'
    if (reason === 'length') return 'max_tokens'
    return 'end_turn'
  }

  extractText(response: ChatResponse): string {
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
  }

  extractToolCalls(response: ChatResponse): ToolUseBlock[] {
    return response.content.filter((b) => b.type === 'tool_use') as ToolUseBlock[]
  }

  getDefaultModel(): string {
    return this.models[0]?.id || ''
  }

  getModel(modelId: string): ModelInfo | undefined {
    return this.models.find((m) => m.id === modelId)
  }
}
