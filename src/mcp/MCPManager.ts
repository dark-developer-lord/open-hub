import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { ToolDefinition } from '../providers/types.js'
import { Tool, ToolResult } from '../tools/types.js'
import config, { MCPServerConfig } from '../config/Config.js'
import { colors } from '../ui/colors.js'

export interface MCPServerStatus {
  name: string
  config: MCPServerConfig
  client: Client | null
  connected: boolean
  tools: ToolDefinition[]
  error?: string
}

/**
 * Scans environment variables for MCP server definitions.
 * Pattern: MCP_SERVER_<NAME>_TYPE    (stdio|http|sse)
 *          MCP_SERVER_<NAME>_URL     (for http/sse)
 *          MCP_SERVER_<NAME>_COMMAND (for stdio)
 *          MCP_SERVER_<NAME>_ARGS    (comma-separated args for stdio)
 */
function loadEnvMCPServers(): Record<string, MCPServerConfig> {
  const servers: Record<string, MCPServerConfig> = {}
  const seen = new Set<string>()

  for (const [key] of Object.entries(process.env)) {
    const match = key.match(/^MCP_SERVER_([A-Z0-9_]+)_TYPE$/i)
    if (match) {
      const envId = match[1]
      const name = envId.toLowerCase().replace(/_/g, '-')
      if (seen.has(name)) continue
      seen.add(name)

      const type = (process.env[`MCP_SERVER_${envId}_TYPE`] || 'stdio') as 'stdio' | 'http' | 'sse'
      const url = process.env[`MCP_SERVER_${envId}_URL`]
      const command = process.env[`MCP_SERVER_${envId}_COMMAND`]
      const argsStr = process.env[`MCP_SERVER_${envId}_ARGS`] || ''
      const args = argsStr ? argsStr.split(',').map((a) => a.trim()).filter(Boolean) : []

      servers[name] = { type, url, command, args, scope: 'user' }
    }
  }

  return servers
}

export class MCPManager {
  private servers: Map<string, MCPServerStatus> = new Map()

  async loadServers() {
    // 1. Project-local mcp.json from current working directory (highest priority)
    const cwdMcpFile = join(process.cwd(), 'mcp.json')
    if (existsSync(cwdMcpFile)) {
      try {
        const data = JSON.parse(readFileSync(cwdMcpFile, 'utf-8'))
        const cwdServers: Record<string, MCPServerConfig> = data.mcpServers || data || {}
        for (const [name, serverConfig] of Object.entries(cwdServers)) {
          if (!this.servers.has(name)) {
            await this.connect(name, serverConfig as MCPServerConfig)
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // 2. Global mcp.json from ~/.agent-cli/mcp.json
    const globalServers = config.loadMCPServers()
    for (const [name, serverConfig] of Object.entries(globalServers)) {
      if (!this.servers.has(name)) {
        await this.connect(name, serverConfig)
      }
    }

    // 3. Environment variable–declared MCP servers
    const envServers = loadEnvMCPServers()
    for (const [name, serverConfig] of Object.entries(envServers)) {
      if (!this.servers.has(name)) {
        await this.connect(name, serverConfig)
      }
    }
  }

  async connect(name: string, serverConfig: MCPServerConfig): Promise<MCPServerStatus> {
    // Disconnect existing if any
    if (this.servers.has(name)) {
      await this.disconnect(name)
    }

    const status: MCPServerStatus = {
      name,
      config: serverConfig,
      client: null,
      connected: false,
      tools: [],
    }

    this.servers.set(name, status)

    try {
      const client = new Client(
        { name: 'agent-cli', version: '1.0.0' },
        { capabilities: {} }
      )

      let transport: StdioClientTransport | SSEClientTransport

      if (serverConfig.type === 'stdio') {
        if (!serverConfig.command) throw new Error('stdio server requires command')
        transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: { ...process.env, ...(serverConfig.env || {}) } as Record<string, string>,
        })
      } else if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
        if (!serverConfig.url) throw new Error('HTTP/SSE server requires url')
        transport = new SSEClientTransport(new URL(serverConfig.url))
      } else {
        throw new Error(`Unknown transport type: ${serverConfig.type}`)
      }

      await client.connect(transport)

      // List available tools
      const toolsResult = await client.listTools()
      const tools: ToolDefinition[] = (toolsResult.tools || []).map((t: {
        name: string
        description?: string
        inputSchema?: unknown
      }) => ({
        name: `mcp__${name}__${t.name}`,
        description: t.description || `MCP tool from ${name}`,
        input_schema: (t.inputSchema as ToolDefinition['input_schema']) || {
          type: 'object' as const,
          properties: {},
        },
      }))

      status.client = client
      status.connected = true
      status.tools = tools
    } catch (err) {
      status.error = String(err)
      status.connected = false
    }

    return status
  }

  async disconnect(name: string) {
    const status = this.servers.get(name)
    if (status?.client) {
      try {
        await status.client.close()
      } catch {
        // ignore
      }
      status.client = null
      status.connected = false
    }
  }

  async disconnectAll() {
    for (const name of this.servers.keys()) {
      await this.disconnect(name)
    }
  }

  getServerStatus(name: string): MCPServerStatus | undefined {
    return this.servers.get(name)
  }

  getAllServers(): MCPServerStatus[] {
    return Array.from(this.servers.values())
  }

  getConnectedTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = []
    for (const status of this.servers.values()) {
      if (status.connected) {
        tools.push(...status.tools)
      }
    }
    return tools
  }

  async callTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
    // Parse server name from tool name: mcp__serverName__toolName
    const parts = toolName.split('__')
    if (parts.length < 3 || parts[0] !== 'mcp') {
      return { success: false, output: '', error: `Invalid MCP tool name: ${toolName}` }
    }

    const serverName = parts[1]
    const actualToolName = parts.slice(2).join('__')
    const status = this.servers.get(serverName)

    if (!status?.client || !status.connected) {
      return { success: false, output: '', error: `MCP server '${serverName}' is not connected` }
    }

    try {
      const result = await status.client.callTool({
        name: actualToolName,
        arguments: input,
      })

      const content = result.content as Array<{ type: string; text?: string }>
      const output = content
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n')

      return { success: !result.isError, output }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }

  printStatus() {
    const servers = this.getAllServers()
    if (servers.length === 0) {
      console.log(colors.muted('  No MCP servers configured. Use /mcp add <name> --transport stdio -- <command>'))
      return
    }

    for (const s of servers) {
      const icon = s.connected ? colors.success('✓') : colors.error('✗')
      const toolCount = s.connected ? colors.muted(` (${s.tools.length} tools)`) : ''
      const err = s.error ? colors.error(` — ${s.error}`) : ''
      console.log(`  ${icon} ${colors.bold(s.name)} [${s.config.type}]${toolCount}${err}`)
    }
  }
}

export const mcpManager = new MCPManager()
