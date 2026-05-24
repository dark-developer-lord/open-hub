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

    const openAIMessages = messages.flatMap((m) => this.convertMessages(m))
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
    // DeepSeek-R1 / thinking models return reasoning_content
    const reasoningContent: string | undefined = (choice.message as any).reasoning_content || undefined

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
      reasoning_content: reasoningContent,
    }
  }

  /** Convert one Message → one or more OpenAI chat params. Tool results expand to N messages (one per call). */
  protected convertMessages(msg: Message): OpenAI.ChatCompletionMessageParam[] {
    if (typeof msg.content === 'string') {
      return [{ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content }]
    }

    const textBlocks = msg.content.filter((b) => b.type === 'text')
    const toolResults = msg.content.filter((b) => b.type === 'tool_result')
    const toolUses = msg.content.filter((b) => b.type === 'tool_use')

    // Each tool result must be its own message with the matching tool_call_id
    if (toolResults.length > 0) {
      return toolResults.map((b) => {
        const tr = b as { type: 'tool_result'; tool_use_id: string; content: string | unknown[] }
        const content = typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
        return {
          role: 'tool' as const,
          tool_call_id: tr.tool_use_id || '',
          content,
        } as OpenAI.ChatCompletionToolMessageParam
      })
    }

    if (toolUses.length > 0 && msg.role === 'assistant') {
      return [{
        role: 'assistant',
        content: textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('') || null,
        ...(msg.reasoning_content ? { reasoning_content: msg.reasoning_content } : {}),
        tool_calls: toolUses.map((b) => {
          const tu = b as ToolUseBlock
          return {
            id: tu.id,
            type: 'function' as const,
            function: { name: tu.name, arguments: JSON.stringify(tu.input) },
          }
        }),
      }]
    }

    const text = textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('')
    return [{
      role: msg.role as 'user' | 'assistant' | 'system',
      content: text,
      ...(msg.reasoning_content ? { reasoning_content: msg.reasoning_content } : {}),
    } as OpenAI.ChatCompletionMessageParam]
  }

  /** @deprecated Use convertMessages() instead */
  protected convertMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
    return this.convertMessages(msg)[0]
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
