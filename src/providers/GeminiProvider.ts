import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { BaseProvider, Message, ChatOptions, ChatResponse, ModelInfo, ContentBlock } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export class GeminiProvider extends BaseProvider {
  readonly id = 'google'
  readonly name = 'Google Gemini'
  readonly models: ModelInfo[] = [
    // ── Gemini 2.5 (current) ──────────────────────────────────────────────────
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    // ── Gemini 3.1 Preview ────────────────────────────────────────────────────
    { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live (preview)', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    { id: 'gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS (preview)', contextWindow: 1048576, supportsTools: false, supportsVision: false },
    // ── Gemini 2.0 ────────────────────────────────────────────────────────────
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    // ── Gemma open-weight ─────────────────────────────────────────────────────
    { id: 'gemma-4', name: 'Gemma 4', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'gemma-3n', name: 'Gemma 3n', contextWindow: 8192, supportsTools: false, supportsVision: true },
    { id: 'gemma-3', name: 'Gemma 3', contextWindow: 131072, supportsTools: true, supportsVision: true },
    { id: 'gemma-2', name: 'Gemma 2 (legacy)', contextWindow: 8192, supportsTools: false, supportsVision: false },
    // ── Legacy ────────────────────────────────────────────────────────────────
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (legacy)', contextWindow: 2097152, supportsTools: true, supportsVision: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (legacy)', contextWindow: 1048576, supportsTools: true, supportsVision: true },
    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro (legacy)', contextWindow: 32768, supportsTools: true, supportsVision: false },
  ]

  private genAI: GoogleGenerativeAI | null = null
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey)
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.genAI) throw new Error('Google API key not configured')

    const model = this.genAI.getGenerativeModel({
      model: options.model,
      systemInstruction: options.system,
    })

    // Convert to Gemini format
    const history = messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : this.extractTextFromBlocks(m.content) }],
      }))

    const lastMessage = messages[messages.length - 1]
    const userMessage = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : this.extractTextFromBlocks(lastMessage.content)

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(userMessage)
    const response = await result.response

    const text = response.text()
    return {
      content: [{ type: 'text', text }],
      model: options.model,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      },
      stopReason: 'end_turn',
    }
  }

  private extractTextFromBlocks(blocks: ContentBlock[]): string {
    return blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
  }
}
