import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import dotenv from 'dotenv'

dotenv.config()

export interface CustomProviderModelConfig {
  id: string
  name: string
  contextWindow?: number
  supportsTools?: boolean
  supportsVision?: boolean
}

export interface CustomProviderConfig {
  id: string
  name: string
  baseURL: string
  apiKey?: string
  allowEmptyKey?: boolean
  models?: CustomProviderModelConfig[]
}

export interface AgentConfig {
  providers: {
    anthropic?: { apiKey: string }
    openai?: { apiKey: string }
    google?: { apiKey: string }
    groq?: { apiKey: string }
    mistral?: { apiKey: string }
    xai?: { apiKey: string }
    perplexity?: { apiKey: string }
    deepseek?: { apiKey: string }
    together?: { apiKey: string }
    fireworks?: { apiKey: string }
    cerebras?: { apiKey: string }
    cohere?: { apiKey: string }
    novita?: { apiKey: string }
    qwen?: { apiKey: string }
    ollama?: { host?: string }
    azure?: { apiKey: string; endpoint: string; apiVersion?: string }
  }
  customProviders?: CustomProviderConfig[]
  defaults: {
    provider: string
    model: string
    maxTokens: number
    effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  }
  agent: {
    maxGoalIterations: number
    goalCheckInterval: number
    autoApproveTools: string[]
    denyTools: string[]
  }
  mcp: {
    servers: Record<string, MCPServerConfig>
  }
  sessions: {
    dir: string
  }
  permissionMode: 'default' | 'acceptEdits' | 'plan' | 'auto' | 'bypassPermissions'
}

export interface MCPServerConfig {
  type: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  scope: 'local' | 'project' | 'user'
}

const CONFIG_DIR = join(homedir(), '.agent-cli')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const MCP_FILE = join(CONFIG_DIR, 'mcp.json')

const defaultConfig: AgentConfig = {
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || '' },
    openai: { apiKey: process.env.OPENAI_API_KEY || '' },
    google: { apiKey: process.env.GOOGLE_API_KEY || '' },
    groq: { apiKey: process.env.GROQ_API_KEY || '' },
    mistral: { apiKey: process.env.MISTRAL_API_KEY || '' },
    xai: { apiKey: process.env.XAI_API_KEY || '' },
    perplexity: { apiKey: process.env.PERPLEXITY_API_KEY || '' },
    deepseek: { apiKey: process.env.DEEPSEEK_API_KEY || '' },
    together: { apiKey: process.env.TOGETHER_API_KEY || '' },
    fireworks: { apiKey: process.env.FIREWORKS_API_KEY || '' },
    cerebras: { apiKey: process.env.CEREBRAS_API_KEY || '' },
    cohere: { apiKey: process.env.COHERE_API_KEY || '' },
    novita: { apiKey: process.env.NOVITA_API_KEY || '' },
    qwen: { apiKey: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || '' },
    ollama: { host: process.env.OLLAMA_HOST || 'http://localhost:11434' },
    azure: {
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
    },
  },
  defaults: {
    provider: process.env.DEFAULT_PROVIDER || 'anthropic',
    model: process.env.DEFAULT_MODEL || 'claude-opus-4-5',
    maxTokens: parseInt(process.env.MAX_TOKENS_PER_TURN || '32768'),
    effort: 'medium',
  },
  agent: {
    maxGoalIterations: parseInt(process.env.MAX_GOAL_ITERATIONS || '200'),
    goalCheckInterval: parseInt(process.env.GOAL_CHECK_INTERVAL || '3'),
    autoApproveTools: [],
    denyTools: [],
  },
  customProviders: [],
  mcp: {
    servers: {},
  },
  sessions: {
    dir: process.env.SESSIONS_DIR || join(CONFIG_DIR, 'sessions'),
  },
  permissionMode: (process.env.AGENT_PERMISSION_MODE as AgentConfig['permissionMode']) || 'bypassPermissions',
}

class Config {
  private config: AgentConfig
  private configDir: string

  constructor() {
    this.configDir = CONFIG_DIR
    this.ensureConfigDir()
    this.config = this.load()
  }

  private ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    const sessionsDir = this.config?.sessions?.dir || join(CONFIG_DIR, 'sessions')
    if (!existsSync(sessionsDir)) {
      mkdirSync(sessionsDir, { recursive: true })
    }
  }

  private load(): AgentConfig {
    if (!existsSync(CONFIG_FILE)) {
      return { ...defaultConfig }
    }
    try {
      const stored = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      // Deep merge with defaults
      return this.deepMerge(defaultConfig, stored)
    } catch {
      return { ...defaultConfig }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deepMerge(base: any, override: any): any {
    const result = { ...base }
    for (const key of Object.keys(override)) {
      const val = override[key]
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = this.deepMerge(base[key] || {}, val)
      } else if (val !== undefined) {
        result[key] = val
      }
    }
    return result
  }

  save() {
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2))
  }

  get(): AgentConfig {
    return this.config
  }

  set<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.config as any)[key] = value
    this.save()
  }

  getConfigDir(): string {
    return this.configDir
  }

  getMCPFile(): string {
    return MCP_FILE
  }

  loadMCPServers(): Record<string, MCPServerConfig> {
    if (!existsSync(MCP_FILE)) return {}
    try {
      const data = JSON.parse(readFileSync(MCP_FILE, 'utf-8'))
      return data.mcpServers || {}
    } catch {
      return {}
    }
  }

  saveMCPServer(name: string, serverConfig: MCPServerConfig) {
    const servers = this.loadMCPServers()
    servers[name] = serverConfig
    writeFileSync(MCP_FILE, JSON.stringify({ mcpServers: servers }, null, 2))
  }

  removeMCPServer(name: string) {
    const servers = this.loadMCPServers()
    delete servers[name]
    writeFileSync(MCP_FILE, JSON.stringify({ mcpServers: servers }, null, 2))
  }

  saveCustomProvider(cfg: CustomProviderConfig) {
    const current = this.config.customProviders || []
    const filtered = current.filter((p) => p.id !== cfg.id)
    this.config.customProviders = [...filtered, cfg]
    this.save()
  }

  removeCustomProvider(id: string) {
    const current = this.config.customProviders || []
    this.config.customProviders = current.filter((p) => p.id !== id)
    this.save()
  }
}

export const config = new Config()
export default config
