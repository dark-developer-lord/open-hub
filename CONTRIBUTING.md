# Contributing to Agent CLI

Thank you for your interest in contributing!

## Ways to contribute

- **Add a new AI provider** — see existing providers in `src/providers/` for the pattern
- **Add a new built-in tool** — add to `src/tools/FileTool.ts` or `src/tools/SystemTool.ts`, register in `ToolRegistry.ts`
- **Report bugs** — open a GitHub issue with steps to reproduce
- **Improve docs** — README, examples, or inline code comments

## Development setup

```bash
git clone https://github.com/dark-developer-lord/open-hub.git
cd open-hub
npm install
cp .env.example .env   # add your API keys
npm run dev -- -p "test"
```

## Adding a new provider

1. Create `src/providers/MyProvider.ts` extending `OpenAICompatProvider` (for OpenAI-compatible APIs) or implementing the `Provider` interface directly
2. Export it from `src/providers/index.ts`
3. Register it in `initProviders()` in `src/providers/index.ts`

Use an existing provider like `src/providers/GroqProvider.ts` as a template.

## Adding a new tool

1. Add a class extending `BaseTool` to an appropriate file in `src/tools/`
2. Define `definition: ToolDefinition` with name, description, and JSON schema for inputs
3. Implement `execute(input): Promise<ToolResult>`
4. Register it in `src/tools/ToolRegistry.ts` → `registerBuiltins()`

## Pull request checklist

- [ ] `npm run lint` passes (no TypeScript errors)
- [ ] `npm run build` succeeds
- [ ] New functionality is documented in README.md

## Code style

- TypeScript strict mode
- ESM modules (`import`/`export`, no `require`)
- Async/await, no callbacks
- No default exports except for singleton classes

## License

By contributing, you agree your contributions will be licensed under the [MIT License](LICENSE).
