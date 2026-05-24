import Groq from 'groq-sdk'
import type { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions.js'
import { BaseProvider, Message, ChatOptions, ChatResponse, ModelInfo, ContentBlock, ToolUseBlock } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export class GroqProvider extends BaseProvider {
  readonly id = 'groq'
  readonly name = 'Groq'
  readonly models: ModelInfo[] = [
    // ── Llama 4 ───────────────────────────────────────────────────────────────
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', contextWindow: 131072, supportsTools: true, supportsVision: true },
    // ── Llama 3.x ─────────────────────────────────────────────────────────────
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B SpecDec', contextWindow: 8192, supportsTools: false, supportsVision: false },
    { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', contextWindow: 8192, supportsTools: false, supportsVision: true },
    { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision', contextWindow: 8192, supportsTools: false, supportsVision: true },
    { id: 'llama-3.2-3b-preview', name: 'Llama 3.2 3B', contextWindow: 8192, supportsTools: false, supportsVision: false },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, supportsTools: true, supportsVision: false },
    // ── DeepSeek reasoning ────────────────────────────────────────────────────
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', contextWindow: 131072, supportsTools: false, supportsVision: false },
    // ── Qwen ─────────────────────────────────────────────────────────────────
    { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'qwen-3-32b', name: 'Qwen 3 32B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    // ── Mistral ───────────────────────────────────────────────────────────────
    { id: 'mistral-saba-24b', name: 'Mistral Saba 24B', contextWindow: 32768, supportsTools: true, supportsVision: false },
    // ── Gemma ─────────────────────────────────────────────────────────────────
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8192, supportsTools: true, supportsVision: false },
    // ── Legacy ────────────────────────────────────────────────────────────────
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (legacy)', contextWindow: 32768, supportsTools: true, supportsVision: false },
  ]

  private client: Groq | null = null
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
    if (apiKey) {
      this.client = new Groq({ apiKey })
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.client) throw new Error('Groq API key not configured')

    const groqMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: typeof m.content === 'string' ? m.content : this.extractTextBlocks(m.content),
    }))

    const tools = options.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))

    const params: ChatCompletionCreateParamsNonStreaming = {
      model: options.model,
      messages: groqMessages,
      max_tokens: options.maxTokens,
      stream: false,
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
      model: options.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    }
  }

  private extractTextBlocks(blocks: ContentBlock[]): string {
    return blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
  }
}
