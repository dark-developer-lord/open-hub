/**
 * Terminal UI built with ink (React for CLI).
 * Provides a beautiful chat interface with command palette,
 * interactive model selector, and API key manager.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text, useInput, useApp, Static, render } from 'ink'
import TextInput from 'ink-text-input'
import type { Agent } from '../agent/Agent.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TUIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  tools: { name: string; status: 'running' | 'done' | 'error' }[]
  done: boolean
}

export interface TUIStatusInfo {
  provider: string
  model: string
  mcpCount: number
  tokens: number
}

export interface ProviderModelInfo {
  id: string
  name: string
  configured: boolean
  keyMasked?: string
  models: Array<{ id: string; name: string }>
}

export interface TUIProps {
  agent: Agent
  statusInfo: TUIStatusInfo
  onChat: (text: string) => Promise<void>
  onSlashCommand: (input: string) => Promise<string | undefined>
  initialQuery?: string
  getProviders: () => ProviderModelInfo[]
  getStatus: () => { provider: string; model: string }
  onSetModel: (providerId: string, modelId: string) => void
  onSetApiKey: (providerId: string, key: string) => void
}

// ── App mode ──────────────────────────────────────────────────────────────────
type AppMode = 'chat' | 'model-select' | 'settings' | 'key-edit'

// ── Nav item (model selector) ─────────────────────────────────────────────────
interface ModelNavItem {
  modelId: string
  modelName: string
  providerId: string
  providerName: string
  providerConfigured: boolean
  isGroupStart: boolean
}

function buildModelNavItems(providers: ProviderModelInfo[]): ModelNavItem[] {
  const items: ModelNavItem[] = []
  for (const p of providers) {
    if (p.models.length === 0) continue
    p.models.forEach((m, i) => {
      items.push({
        modelId: m.id,
        modelName: m.name,
        providerId: p.id,
        providerName: p.name,
        providerConfigured: p.configured,
        isGroupStart: i === 0,
      })
    })
  }
  return items
}

// ── Commands ──────────────────────────────────────────────────────────────────
const COMMANDS = [
  { name: '/goal',     args: '<task>',  desc: 'Autonomous goal loop' },
  { name: '/model',    args: '[name]',  desc: 'Pick model (no args → selector)' },
  { name: '/keys',     args: '',        desc: 'Manage API keys' },
  { name: '/provider', args: '<name>',  desc: 'Switch provider' },
  { name: '/clear',    args: '',        desc: 'Clear chat history' },
  { name: '/compact',  args: '',        desc: 'Compact conversation' },
  { name: '/tokens',   args: '',        desc: 'Token usage' },
  { name: '/save',     args: '[name]',  desc: 'Save session' },
  { name: '/sessions', args: '',        desc: 'List saved sessions' },
  { name: '/resume',   args: '<id>',    desc: 'Resume session' },
  { name: '/plan',     args: '<task>',  desc: 'Plan only (no execution)' },
  { name: '/tools',    args: '',        desc: 'List available tools' },
  { name: '/mcp',      args: '',        desc: 'MCP server status' },
  { name: '/help',     args: '',        desc: 'Show help' },
  { name: '/exit',     args: '',        desc: 'Exit' },
]

// ── StatusBar ─────────────────────────────────────────────────────────────────
const StatusBar = ({ provider, model, mcpCount, tokens, goalActive }: {
  provider: string; model: string; mcpCount: number; tokens: number; goalActive: boolean
}) => (
  <Box paddingX={1} borderStyle="single" borderColor="cyan">
    <Text color="cyan" bold>◆ OPEN-HUB</Text>
    <Text color="gray">  ·  </Text>
    <Text color="white">{provider}</Text>
    <Text color="gray"> / </Text>
    <Text color="yellow">{model}</Text>
    {mcpCount > 0 && <Text color="green">  ·  {mcpCount} MCP</Text>}
    {goalActive && <Text color="magenta">  ·  🎯 GOAL</Text>}
    {tokens > 0 && <Text color="gray">  ·  ↑{tokens} tok</Text>}
    <Box flexGrow={1}><Text> </Text></Box>
    <Text color="gray" dimColor>Tab: cmds  /model  /keys</Text>
  </Box>
)

// ── Message components ────────────────────────────────────────────────────────
const UserMessage = ({ msg }: { msg: TUIMessage }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box paddingLeft={1}>
      <Text color="blue" bold> You </Text>
      <Text color="gray" dimColor>›</Text>
    </Box>
    <Box paddingLeft={3}>
      <Text wrap="wrap">{msg.text}</Text>
    </Box>
  </Box>
)

const AssistantMessage = ({ msg }: { msg: TUIMessage }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box paddingLeft={1}>
      <Text color="green" bold>Agent</Text>
      <Text color="gray" dimColor> ›</Text>
    </Box>
    {msg.tools.map((t, i) => (
      <Box key={i} paddingLeft={3}>
        <Text color="yellow">⚙ {t.name}</Text>
        <Text color="gray"> ... </Text>
        {t.status === 'running' && <Text color="yellow">●</Text>}
        {t.status === 'done'    && <Text color="green">✓</Text>}
        {t.status === 'error'   && <Text color="red">✗</Text>}
      </Box>
    ))}
    {msg.text ? (
      <Box paddingLeft={3}>
        <Text wrap="wrap">{msg.text}</Text>
      </Box>
    ) : (!msg.done && msg.tools.length === 0) ? (
      <Box paddingLeft={3}><Text color="yellow" dimColor>●  thinking...</Text></Box>
    ) : null}
  </Box>
)

const SystemMessage = ({ msg }: { msg: TUIMessage }) => (
  <Box marginBottom={1} paddingLeft={1}>
    <Text color="gray" dimColor>ℹ  {msg.text}</Text>
  </Box>
)

const MessageView = ({ msg }: { msg: TUIMessage }) => {
  if (msg.role === 'user')   return <UserMessage msg={msg} />
  if (msg.role === 'system') return <SystemMessage msg={msg} />
  return <AssistantMessage msg={msg} />
}

// ── Command palette ───────────────────────────────────────────────────────────
const CommandPalette = ({ filter }: { filter: string }) => {
  const isFiltering = filter.startsWith('/')
  const filtered = isFiltering
    ? COMMANDS.filter(c => c.name.startsWith(filter.split(' ')[0]))
    : COMMANDS
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginX={1} marginBottom={1}>
      <Box>
        <Text color="gray" bold> Commands  </Text>
        <Text color="gray" dimColor>(Tab to hide)</Text>
      </Box>
      {filtered.map(cmd => (
        <Box key={cmd.name}>
          <Text color="cyan">{cmd.name}</Text>
          {cmd.args ? <Text color="gray" dimColor> {cmd.args}</Text> : null}
          <Text color="gray" dimColor>  —  {cmd.desc}</Text>
        </Box>
      ))}
    </Box>
  )
}

// ── Model Selector ────────────────────────────────────────────────────────────
const MAX_MODEL_VIEW = 16

const ModelSelector = ({
  items,
  cursor,
  currentProvider,
  currentModel,
}: {
  items: ModelNavItem[]
  cursor: number
  currentProvider: string
  currentModel: string
}) => {
  const viewStart = Math.max(
    0,
    Math.min(cursor - Math.floor(MAX_MODEL_VIEW / 2), Math.max(0, items.length - MAX_MODEL_VIEW)),
  )
  const visible = items.slice(viewStart, viewStart + MAX_MODEL_VIEW)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginX={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold> Select Model </Text>
        <Text color="gray" dimColor>  ↑↓ navigate · Enter select · Esc cancel</Text>
      </Box>

      {visible.map((item, vi) => {
        const realIdx = viewStart + vi
        const isCursor = realIdx === cursor
        const isCurrent = item.providerName === currentProvider && item.modelId === currentModel

        return (
          <Box key={`${item.providerId}-${item.modelId}`} flexDirection="column">
            {item.isGroupStart && (
              <Box marginTop={vi === 0 ? 0 : 1}>
                <Text
                  color={item.providerConfigured ? 'green' : 'gray'}
                  bold
                >
                  {item.providerConfigured ? '● ' : '○ '}{item.providerName}
                </Text>
                {!item.providerConfigured && (
                  <Text color="gray" dimColor>  — no key</Text>
                )}
              </Box>
            )}
            <Box paddingLeft={2}>
              {isCursor
                ? <Text color="cyan" bold>▶ </Text>
                : isCurrent
                  ? <Text color="yellow">✓ </Text>
                  : <Text>  </Text>
              }
              <Text
                color={isCursor ? 'cyan' : isCurrent ? 'yellow' : item.providerConfigured ? 'white' : 'gray'}
                bold={isCursor}
                dimColor={!isCursor && !isCurrent && !item.providerConfigured}
              >
                {item.modelName}
              </Text>
            </Box>
          </Box>
        )
      })}

      {items.length > MAX_MODEL_VIEW && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {cursor + 1}/{items.length}{'  '}
            {viewStart > 0 ? '↑ more  ' : ''}
            {viewStart + MAX_MODEL_VIEW < items.length ? '↓ more' : ''}
          </Text>
        </Box>
      )}
    </Box>
  )
}

// ── Settings (API Keys) ───────────────────────────────────────────────────────
const SettingsPanel = ({
  providers,
  cursor,
}: {
  providers: ProviderModelInfo[]
  cursor: number
}) => (
  <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginX={1} marginBottom={1}>
    <Box marginBottom={1}>
      <Text color="magenta" bold> API Keys </Text>
      <Text color="gray" dimColor>  ↑↓ navigate · Enter edit · Esc close</Text>
    </Box>
    {providers.map((p, i) => {
      const isCursor = i === cursor
      return (
        <Box key={p.id}>
          {isCursor
            ? <Text color="magenta" bold>▶ </Text>
            : p.configured
              ? <Text color="green">✓ </Text>
              : <Text color="gray" dimColor>○ </Text>
          }
          <Text
            color={isCursor ? 'magenta' : p.configured ? 'white' : 'gray'}
            bold={isCursor}
          >
            {p.name.padEnd(14)}
          </Text>
          {p.configured && p.keyMasked
            ? <Text color="gray" dimColor>{p.keyMasked}</Text>
            : <Text color="gray" dimColor>(not configured)</Text>
          }
        </Box>
      )
    })}
    <Box marginTop={1}>
      <Text color="gray" dimColor>Enter to edit key · Esc to close</Text>
    </Box>
  </Box>
)

// ── Key Editor ────────────────────────────────────────────────────────────────
const KeyEditor = ({
  provider,
  keyInput,
  onChange,
  onSubmit,
}: {
  provider: ProviderModelInfo
  keyInput: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
}) => (
  <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginX={1} marginBottom={1}>
    <Box marginBottom={1}>
      <Text color="magenta" bold> Edit API Key — {provider.name} </Text>
    </Box>
    {provider.keyMasked && (
      <Box marginBottom={1}>
        <Text color="gray" dimColor>Current: {provider.keyMasked}</Text>
      </Box>
    )}
    <Box marginBottom={1}>
      <Text color="cyan" bold>Key › </Text>
      <TextInput
        value={keyInput}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="Paste your API key and press Enter..."
      />
    </Box>
    <Text color="gray" dimColor>Enter to save · Esc to cancel · Empty + Enter to remove</Text>
  </Box>
)

// ── Main App ──────────────────────────────────────────────────────────────────
const App = ({
  agent,
  statusInfo: initialStatus,
  onChat,
  onSlashCommand,
  initialQuery,
  getProviders,
  getStatus,
  onSetModel,
  onSetApiKey,
}: TUIProps) => {
  const { exit } = useApp()
  const [completedMsgs, setCompletedMsgs] = useState<TUIMessage[]>([])
  const [streamingMsg, setStreamingMsg]   = useState<TUIMessage | null>(null)
  const [input, setInput]                  = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [showCmds, setShowCmds]           = useState(false)
  const [status, setStatus]               = useState(initialStatus)
  const [goalActive, setGoalActive]       = useState(false)

  // Modal state
  const [mode, setMode]                           = useState<AppMode>('chat')
  const [modelNavItems, setModelNavItems]         = useState<ModelNavItem[]>([])
  const [settingsProviders, setSettingsProviders] = useState<ProviderModelInfo[]>([])
  const [navCursor, setNavCursor]                 = useState(0)
  const [editingProvider, setEditingProvider]     = useState<ProviderModelInfo | null>(null)
  const [keyInput, setKeyInput]                   = useState('')

  const idRef = useRef(0)
  const nextId = () => String(++idRef.current)

  // ── Agent events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onText = (text: string) => {
      setStreamingMsg(prev => {
        const base = prev ?? { id: nextId(), role: 'assistant' as const, text: '', tools: [], done: false }
        return { ...base, text: base.text + text }
      })
    }
    const onToolStart = (name: string) => {
      setStreamingMsg(prev => {
        const base = prev ?? { id: nextId(), role: 'assistant' as const, text: '', tools: [], done: false }
        return { ...base, tools: [...base.tools, { name, status: 'running' as const }] }
      })
    }
    const onToolEnd = (name: string, success: boolean) => {
      setStreamingMsg(prev => {
        if (!prev) return prev
        const tools = [...prev.tools]
        const idx = tools.map(t => t.name).lastIndexOf(name)
        if (idx !== -1) tools[idx] = { name, status: success ? 'done' : 'error' }
        return { ...prev, tools }
      })
    }
    const onTurnEnd = () => {
      setStreamingMsg(prev => {
        if (prev) {
          const done = { ...prev, done: true }
          setCompletedMsgs(msgs => [...msgs, done])
        }
        return null
      })
      setIsLoading(false)
      const tok = agent.getTotalTokens()
      setStatus(s => ({ ...s, tokens: tok.input + tok.output }))
    }
    const onGoalStart = () => setGoalActive(true)
    const onGoalEnd   = () => setGoalActive(false)

    agent.on('text',      onText)
    agent.on('toolStart', onToolStart)
    agent.on('toolEnd',   onToolEnd)
    agent.on('turnEnd',   onTurnEnd)
    agent.on('goalStart', onGoalStart)
    agent.on('goalEnd',   onGoalEnd)

    return () => {
      agent.off('text',      onText)
      agent.off('toolStart', onToolStart)
      agent.off('toolEnd',   onToolEnd)
      agent.off('turnEnd',   onTurnEnd)
      agent.off('goalStart', onGoalStart)
      agent.off('goalEnd',   onGoalEnd)
    }
  }, [agent])

  // Run initial query
  useEffect(() => {
    if (initialQuery) void submit(initialQuery)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addSysMsg = (text: string) => {
    setCompletedMsgs(msgs => [
      ...msgs,
      { id: nextId(), role: 'system', text, tools: [], done: true },
    ])
  }

  const openModelSelect = useCallback(() => {
    const providers = getProviders()
    const items = buildModelNavItems(providers)
    setModelNavItems(items)
    // Start cursor on current model
    const cur = getStatus()
    const startIdx = items.findIndex(
      it => it.providerName === cur.provider && it.modelId === cur.model,
    )
    setNavCursor(Math.max(0, startIdx))
    setMode('model-select')
    setShowCmds(false)
  }, [getProviders, getStatus])

  const openSettings = useCallback(() => {
    setSettingsProviders(getProviders())
    setNavCursor(0)
    setMode('settings')
    setShowCmds(false)
  }, [getProviders])

  const closeModal = useCallback(() => {
    setMode('chat')
    setNavCursor(0)
    setKeyInput('')
    setEditingProvider(null)
  }, [])

  const confirmModelSelect = useCallback(() => {
    const item = modelNavItems[navCursor]
    if (!item) return
    if (!item.providerConfigured) {
      closeModal()
      addSysMsg(`⚠  ${item.providerName} has no API key — use /keys to configure it first`)
      return
    }
    onSetModel(item.providerId, item.modelId)
    setStatus(s => ({ ...s, provider: item.providerName, model: item.modelId }))
    closeModal()
    addSysMsg(`Switched to ${item.providerName} / ${item.modelId}`)
  }, [modelNavItems, navCursor, onSetModel, closeModal])

  const startKeyEdit = useCallback(() => {
    const p = settingsProviders[navCursor]
    if (!p) return
    setEditingProvider(p)
    setKeyInput('')
    setMode('key-edit')
  }, [settingsProviders, navCursor])

  const saveApiKey = useCallback((value: string) => {
    if (!editingProvider) return
    const trimmed = value.trim()
    onSetApiKey(editingProvider.id, trimmed)
    addSysMsg(
      trimmed
        ? `API key saved for ${editingProvider.name}`
        : `API key removed for ${editingProvider.name}`,
    )
    // Refresh list and return to settings
    setSettingsProviders(getProviders())
    setEditingProvider(null)
    setKeyInput('')
    setMode('settings')
  }, [editingProvider, onSetApiKey, getProviders])

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  // Chat mode
  useInput((_ch, key) => {
    if (key.tab) setShowCmds(v => !v)
    if (key.escape) setShowCmds(false)
  }, { isActive: mode === 'chat' })

  // Model selector
  useInput((_ch, key) => {
    if (key.upArrow)   setNavCursor(c => Math.max(0, c - 1))
    if (key.downArrow) setNavCursor(c => Math.min(modelNavItems.length - 1, c + 1))
    if (key.return)    confirmModelSelect()
    if (key.escape)    closeModal()
  }, { isActive: mode === 'model-select' })

  // Settings panel
  useInput((_ch, key) => {
    if (key.upArrow)   setNavCursor(c => Math.max(0, c - 1))
    if (key.downArrow) setNavCursor(c => Math.min(settingsProviders.length - 1, c + 1))
    if (key.return)    startKeyEdit()
    if (key.escape)    closeModal()
  }, { isActive: mode === 'settings' })

  // Key editor — only capture Escape (TextInput handles the rest)
  useInput((_ch, key) => {
    if (key.escape) {
      setEditingProvider(null)
      setKeyInput('')
      setMode('settings')
    }
  }, { isActive: mode === 'key-edit' })

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = useCallback(async (value: string) => {
    const text = value.trim()
    if (!text || isLoading) return
    setInput('')
    setShowCmds(false)

    // Intercept panel-opening commands
    if (text === '/model' || text === '/models') { openModelSelect(); return }
    if (text === '/keys' || text === '/key' || text === '/settings') { openSettings(); return }

    if (text.startsWith('/')) {
      const userMsg: TUIMessage = { id: nextId(), role: 'user', text, tools: [], done: true }
      setCompletedMsgs(msgs => [...msgs, userMsg])
      setIsLoading(true)
      try {
        const result = await onSlashCommand(text)
        if (result !== undefined) addSysMsg(result)
        const tok = agent.getTotalTokens()
        // Refresh provider/model in case command changed them
        const cur = getStatus()
        setStatus(s => ({ ...s, ...cur, tokens: tok.input + tok.output }))
      } finally {
        setIsLoading(false)
      }
      return
    }

    const userMsg: TUIMessage = { id: nextId(), role: 'user', text, tools: [], done: true }
    setCompletedMsgs(msgs => [...msgs, userMsg])
    setIsLoading(true)
    setStreamingMsg({ id: nextId(), role: 'assistant', text: '', tools: [], done: false })

    try {
      await onChat(text)
    } catch (err: any) {
      setStreamingMsg(null)
      setIsLoading(false)
      const isConn = err?.cause?.code === 'ECONNREFUSED'
      const msg = isConn
        ? '✗ Connection refused — is the provider running? (Ollama: ollama serve)'
        : `✗ ${err?.message ?? String(err)}`
      addSysMsg(msg)
    }
  }, [isLoading, onChat, onSlashCommand, openModelSelect, openSettings, getStatus, agent])

  const showCmdPalette = showCmds || (input.startsWith('/') && input.length > 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column">

      {/* Status bar — always visible */}
      <StatusBar
        provider={status.provider}
        model={status.model}
        mcpCount={status.mcpCount}
        tokens={status.tokens}
        goalActive={goalActive}
      />

      {/* Completed messages (Static = written once, never re-rendered) */}
      <Static items={completedMsgs}>
        {(msg) => <MessageView key={msg.id} msg={msg} />}
      </Static>

      {/* In-progress streaming message (chat mode only) */}
      {mode === 'chat' && streamingMsg && <MessageView msg={streamingMsg} />}

      {/* ── Modals ── */}

      {mode === 'model-select' && (
        <ModelSelector
          items={modelNavItems}
          cursor={navCursor}
          currentProvider={status.provider}
          currentModel={status.model}
        />
      )}

      {mode === 'settings' && (
        <SettingsPanel
          providers={settingsProviders}
          cursor={navCursor}
        />
      )}

      {mode === 'key-edit' && editingProvider && (
        <KeyEditor
          provider={editingProvider}
          keyInput={keyInput}
          onChange={setKeyInput}
          onSubmit={saveApiKey}
        />
      )}

      {/* Command palette (chat mode) */}
      {mode === 'chat' && showCmdPalette && <CommandPalette filter={input} />}

      {/* Input bar (chat mode only) */}
      {mode === 'chat' && (
        <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} paddingX={1}>
          {isLoading ? (
            <Text color="yellow" dimColor> ● Processing...</Text>
          ) : (
            <Box>
              <Text color="cyan" bold> › </Text>
              <TextInput
                value={input}
                onChange={setInput}
                onSubmit={submit}
                placeholder="Type a message, /command, or Tab for commands..."
              />
            </Box>
          )}
        </Box>
      )}

    </Box>
  )
}

// ── Start TUI ─────────────────────────────────────────────────────────────────
export function startTUI(props: TUIProps): void {
  const { unmount } = render(<App {...props} />, { patchConsole: true })
  ;(globalThis as any).__tuiUnmount = unmount
}

