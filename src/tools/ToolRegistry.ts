import { BaseTool, Tool, ToolResult } from './types.js'
import { ToolDefinition } from '../providers/types.js'
import { BashTool } from './BashTool.js'
import { ReadFileTool, WriteFileTool, EditFileTool, ListDirTool, GlobTool, GrepTool, DeleteTool, MoveTool, CopyTool, MakeDirTool, FileInfoTool, ChmodTool } from './FileTool.js'
import { OpenTool, AppleScriptTool, ClipboardReadTool, ClipboardWriteTool, NotifyTool, ScreenshotTool, ProcessListTool, KillProcessTool, SystemInfoTool, ListAppsTool, EnvTool } from './SystemTool.js'

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  constructor() {
    this.registerBuiltins()
  }

  private registerBuiltins() {
    // Shell
    this.register(new BashTool())

    // File operations
    this.register(new ReadFileTool())
    this.register(new WriteFileTool())
    this.register(new EditFileTool())
    this.register(new ListDirTool())
    this.register(new GlobTool())
    this.register(new GrepTool())
    this.register(new DeleteTool())
    this.register(new MoveTool())
    this.register(new CopyTool())
    this.register(new MakeDirTool())
    this.register(new FileInfoTool())
    this.register(new ChmodTool())

    // System / OS
    this.register(new OpenTool())
    this.register(new AppleScriptTool())
    this.register(new ClipboardReadTool())
    this.register(new ClipboardWriteTool())
    this.register(new NotifyTool())
    this.register(new ScreenshotTool())
    this.register(new ProcessListTool())
    this.register(new KillProcessTool())
    this.register(new SystemInfoTool())
    this.register(new ListAppsTool())
    this.register(new EnvTool())
  }

  register(tool: Tool) {
    this.tools.set(tool.definition.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((t) => t.definition)
  }

  getDefinitionsFiltered(allowed?: string[], denied?: string[]): ToolDefinition[] {
    return this.getAll()
      .filter((t) => {
        if (denied?.includes(t.definition.name)) return false
        if (allowed?.length && !allowed.includes(t.definition.name)) return false
        return true
      })
      .map((t) => t.definition)
  }

  async execute(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, output: '', error: `Tool '${name}' not found` }
    }
    try {
      return await tool.execute(input)
    } catch (err) {
      return { success: false, output: '', error: `Tool execution failed: ${String(err)}` }
    }
  }
}

export const toolRegistry = new ToolRegistry()
