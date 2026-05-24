import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, rmSync, copyFileSync, chmodSync } from 'fs'
import { dirname, join, resolve, basename } from 'path'
import { BaseTool, ToolResult } from './types.js'
import { ToolDefinition } from '../providers/types.js'
import glob from 'fast-glob'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class ReadFileTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Read',
    description: 'Read the contents of a file. Returns the file content as a string. Supports reading specific line ranges.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read (relative or absolute)',
        },
        start_line: {
          type: 'number',
          description: 'Start line number (1-based, optional)',
        },
        end_line: {
          type: 'number',
          description: 'End line number (1-based, optional)',
        },
      },
      required: ['path'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(input.path as string)
    const startLine = input.start_line as number | undefined
    const endLine = input.end_line as number | undefined

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` }
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n')
        const start = (startLine || 1) - 1
        const end = endLine !== undefined ? endLine : lines.length
        return { success: true, output: lines.slice(start, end).join('\n') }
      }
      return { success: true, output: content }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

export class WriteFileTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Write',
    description: 'Write content to a file. Creates the file and any necessary directories. Overwrites existing content.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write (relative or absolute)',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(input.path as string)
    const content = input.content as string

    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, content, 'utf-8')
      return { success: true, output: `Written ${content.length} bytes to ${filePath}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

export class EditFileTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Edit',
    description: 'Make a targeted edit to a file by replacing specific text. Provide old_string (exact text to find) and new_string (replacement). The edit will fail if old_string is not found or matches multiple locations.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The replacement text',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(input.path as string)
    const oldString = input.old_string as string
    const newString = input.new_string as string

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` }
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      const occurrences = content.split(oldString).length - 1

      if (occurrences === 0) {
        return { success: false, output: '', error: `old_string not found in file: ${filePath}` }
      }
      if (occurrences > 1) {
        return { success: false, output: '', error: `old_string found ${occurrences} times. Provide more context to make it unique.` }
      }

      const newContent = content.replace(oldString, newString)
      writeFileSync(filePath, newContent, 'utf-8')
      return { success: true, output: `Successfully edited ${filePath}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

export class ListDirTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'LS',
    description: 'List files and directories at a given path. Shows file sizes and types.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)',
        },
        pattern: {
          type: 'string',
          description: 'Glob pattern to filter results (e.g., "**/*.ts")',
        },
      },
      required: [],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = resolve((input.path as string) || '.')
    const pattern = input.pattern as string | undefined

    try {
      if (pattern) {
        const files = await glob(pattern, { cwd: dirPath, dot: true })
        return { success: true, output: files.join('\n') }
      }

      const entries = readdirSync(dirPath)
      const lines = entries.map((entry) => {
        try {
          const stat = statSync(join(dirPath, entry))
          const type = stat.isDirectory() ? 'd' : 'f'
          const size = stat.isFile() ? ` (${stat.size} bytes)` : ''
          return `[${type}] ${entry}${size}`
        } catch {
          return `[?] ${entry}`
        }
      })

      return { success: true, output: lines.join('\n') || '(empty directory)' }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

export class GlobTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Glob',
    description: 'Find files matching a glob pattern. Supports ** for recursive search.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "src/**/*.ts", "**/*.json")',
        },
        cwd: {
          type: 'string',
          description: 'Base directory for the search (default: current directory)',
        },
      },
      required: ['pattern'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const pattern = input.pattern as string
    const cwd = (input.cwd as string) || process.cwd()

    try {
      const files = await glob(pattern, { cwd, dot: true, absolute: false })
      if (files.length === 0) return { success: true, output: '(no matches found)' }
      return { success: true, output: files.join('\n') }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

export class GrepTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Grep',
    description: 'Search for text patterns in files. Supports regex patterns.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in (default: current directory)',
        },
        file_pattern: {
          type: 'string',
          description: 'Glob pattern to filter which files to search (e.g., "**/*.ts")',
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Whether to do case-insensitive search',
        },
      },
      required: ['pattern'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const pattern = input.pattern as string
    const searchPath = resolve((input.path as string) || '.')
    const filePattern = (input.file_pattern as string) || '**/*'
    const caseInsensitive = input.case_insensitive as boolean | undefined

    try {
      const flags = ['rn', caseInsensitive ? 'i' : ''].join('')
      const grepFlag = caseInsensitive ? '-rni' : '-rn'
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const { stdout, stderr } = await execAsync(
        `grep ${grepFlag} --include="${filePattern.replace('**/*', '*')}" "${pattern}" "${searchPath}" 2>/dev/null || true`,
        { maxBuffer: 5 * 1024 * 1024 }
      )

      return { success: true, output: stdout.trim() || '(no matches found)' }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export class DeleteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Delete',
    description: 'Delete a file or directory. Use recursive=true to delete non-empty directories.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file or directory to delete' },
        recursive: { type: 'boolean', description: 'Delete directory and all its contents (default: false)' },
      },
      required: ['path'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(input.path as string)
    const recursive = (input.recursive as boolean) || false

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `Path not found: ${filePath}` }
    }

    try {
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        rmSync(filePath, { recursive: recursive || false, force: false })
      } else {
        unlinkSync(filePath)
      }
      return { success: true, output: `Deleted: ${filePath}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── Move / Rename ──────────────────────────────────────────────────────────

export class MoveTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Move',
    description: 'Move or rename a file or directory. Works across directories.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path (file or directory to move)' },
        destination: { type: 'string', description: 'Destination path (new location or new name)' },
      },
      required: ['source', 'destination'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const src = resolve(input.source as string)
    const dst = resolve(input.destination as string)

    if (!existsSync(src)) {
      return { success: false, output: '', error: `Source not found: ${src}` }
    }

    try {
      mkdirSync(dirname(dst), { recursive: true })
      renameSync(src, dst)
      return { success: true, output: `Moved: ${src} → ${dst}` }
    } catch (err) {
      // renameSync fails across devices; fall back to cp + rm via shell
      try {
        await execAsync(`cp -r "${src}" "${dst}" && rm -rf "${src}"`)
        return { success: true, output: `Moved: ${src} → ${dst}` }
      } catch (err2) {
        return { success: false, output: '', error: String(err2) }
      }
    }
  }
}

// ── Copy ───────────────────────────────────────────────────────────────────

export class CopyTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Copy',
    description: 'Copy a file or directory to a new location.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path to copy from' },
        destination: { type: 'string', description: 'Destination path to copy to' },
      },
      required: ['source', 'destination'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const src = resolve(input.source as string)
    const dst = resolve(input.destination as string)

    if (!existsSync(src)) {
      return { success: false, output: '', error: `Source not found: ${src}` }
    }

    try {
      mkdirSync(dirname(dst), { recursive: true })
      const stat = statSync(src)
      if (stat.isDirectory()) {
        await execAsync(`cp -r "${src}" "${dst}"`)
      } else {
        copyFileSync(src, dst)
      }
      return { success: true, output: `Copied: ${src} → ${dst}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── MakeDir ────────────────────────────────────────────────────────────────

export class MakeDirTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'MakeDir',
    description: 'Create a directory (and all parent directories) at the given path.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['path'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = resolve(input.path as string)
    try {
      mkdirSync(dirPath, { recursive: true })
      return { success: true, output: `Created directory: ${dirPath}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── FileInfo ───────────────────────────────────────────────────────────────

export class FileInfoTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'FileInfo',
    description: 'Get detailed metadata about a file or directory: size, permissions, timestamps, type.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to inspect' },
      },
      required: ['path'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(input.path as string)
    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `Path not found: ${filePath}` }
    }
    try {
      const stat = statSync(filePath)
      const lines = [
        `Path:        ${filePath}`,
        `Type:        ${stat.isDirectory() ? 'directory' : stat.isSymbolicLink() ? 'symlink' : 'file'}`,
        `Size:        ${stat.size} bytes`,
        `Permissions: ${(stat.mode & 0o777).toString(8)}`,
        `Created:     ${stat.birthtime.toISOString()}`,
        `Modified:    ${stat.mtime.toISOString()}`,
        `Accessed:    ${stat.atime.toISOString()}`,
      ]
      return { success: true, output: lines.join('\n') }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}

// ── Chmod ──────────────────────────────────────────────────────────────────

export class ChmodTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Chmod',
    description: 'Change file or directory permissions (mode). Use octal format like 755, 644, 777.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file or directory' },
        mode: { type: 'string', description: 'Permission mode in octal (e.g., "755", "644", "777")' },
      },
      required: ['path', 'mode'],
    },
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(input.path as string)
    const mode = parseInt(input.mode as string, 8)
    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `Path not found: ${filePath}` }
    }
    try {
      chmodSync(filePath, mode)
      return { success: true, output: `Changed permissions of ${filePath} to ${(input.mode as string)}` }
    } catch (err) {
      return { success: false, output: '', error: String(err) }
    }
  }
}
