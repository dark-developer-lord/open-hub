import { OpenAICompatProvider } from './OpenAICompatProvider.js'
import { ModelInfo } from './types.js'

/**
 * Alibaba Cloud — Qwen / DashScope
 * API base: https://dashscope.aliyuncs.com/compatible-mode/v1
 * Key env var: DASHSCOPE_API_KEY  (or QWEN_API_KEY as alias)
 * Docs: https://help.aliyun.com/zh/model-studio/
 */
export class QwenProvider extends OpenAICompatProvider {
  readonly id = 'qwen'
  readonly name = 'Alibaba Qwen (DashScope)'

  readonly models: ModelInfo[] = [
    // ── Qwen3.7 — MoE & dense (newest) ───────────────────────────────────────
    { id: 'qwen3.7-235b-a22b',         name: 'Qwen3.7 235B-A22B',          contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.7-235b-a22b-thinking',name: 'Qwen3.7 235B-A22B (thinking)',contextWindow: 262144, supportsTools: false, supportsVision: false },
    { id: 'qwen3.7-72b',               name: 'Qwen3.7 72B',                 contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.7-72b-thinking',      name: 'Qwen3.7 72B (thinking)',      contextWindow: 262144, supportsTools: false, supportsVision: false },
    { id: 'qwen3.7-32b',               name: 'Qwen3.7 32B',                 contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.7-14b',               name: 'Qwen3.7 14B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.7-7b',                name: 'Qwen3.7 7B',                  contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── Qwen3.7 VL — vision-language ─────────────────────────────────────────
    { id: 'qwen3.7-vl-72b-instruct',   name: 'Qwen3.7 VL 72B',             contextWindow: 262144, supportsTools: true,  supportsVision: true  },
    { id: 'qwen3.7-vl-32b-instruct',   name: 'Qwen3.7 VL 32B',             contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen3.7-vl-7b-instruct',    name: 'Qwen3.7 VL 7B',              contextWindow: 131072, supportsTools: false, supportsVision: true  },
    // ── Qwen3.7 Coder ─────────────────────────────────────────────────────────
    { id: 'qwen3.7-coder-32b-instruct',name: 'Qwen3.7 Coder 32B',          contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.7-coder-7b-instruct', name: 'Qwen3.7 Coder 7B',           contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── QwQ 3.7 — reasoning ───────────────────────────────────────────────────
    { id: 'qwq-3.7-235b-a22b',         name: 'QwQ 3.7 235B-A22B',          contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwq-3.7-72b',               name: 'QwQ 3.7 72B',                 contextWindow: 262144, supportsTools: true,  supportsVision: false },
    // ── Qwen3.6 — MoE & dense ─────────────────────────────────────────────────
    { id: 'qwen3.6-235b-a22b',         name: 'Qwen3.6 235B-A22B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.6-235b-a22b-thinking',name: 'Qwen3.6 235B-A22B (thinking)',contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3.6-72b',               name: 'Qwen3.6 72B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.6-72b-thinking',      name: 'Qwen3.6 72B (thinking)',      contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3.6-32b',               name: 'Qwen3.6 32B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.6-14b',               name: 'Qwen3.6 14B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.6-7b',                name: 'Qwen3.6 7B',                  contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── Qwen3.6 VL — vision-language ─────────────────────────────────────────
    { id: 'qwen3.6-vl-72b-instruct',   name: 'Qwen3.6 VL 72B',             contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen3.6-vl-7b-instruct',    name: 'Qwen3.6 VL 7B',              contextWindow: 131072, supportsTools: false, supportsVision: true  },
    // ── Qwen3.6 Coder ─────────────────────────────────────────────────────────
    { id: 'qwen3.6-coder-32b-instruct',name: 'Qwen3.6 Coder 32B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.6-coder-7b-instruct', name: 'Qwen3.6 Coder 7B',           contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── QwQ 3.6 — reasoning ───────────────────────────────────────────────────
    { id: 'qwq-3.6-235b-a22b',         name: 'QwQ 3.6 235B-A22B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwq-3.6-72b',               name: 'QwQ 3.6 72B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── Qwen3.5 — MoE & dense ─────────────────────────────────────────────────
    { id: 'qwen3.5-235b-a22b',         name: 'Qwen3.5 235B-A22B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-235b-a22b-thinking',name: 'Qwen3.5 235B-A22B (thinking)',contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3.5-72b',               name: 'Qwen3.5 72B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-72b-thinking',      name: 'Qwen3.5 72B (thinking)',      contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3.5-32b',               name: 'Qwen3.5 32B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-32b-thinking',      name: 'Qwen3.5 32B (thinking)',      contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3.5-14b',               name: 'Qwen3.5 14B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-7b',                name: 'Qwen3.5 7B',                  contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-3b',                name: 'Qwen3.5 3B',                  contextWindow: 32768,  supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-1.7b',              name: 'Qwen3.5 1.7B',                contextWindow: 32768,  supportsTools: false, supportsVision: false },
    // ── Qwen3.5 VL — vision-language ─────────────────────────────────────────
    { id: 'qwen3.5-vl-72b-instruct',   name: 'Qwen3.5 VL 72B',             contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen3.5-vl-32b-instruct',   name: 'Qwen3.5 VL 32B',             contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen3.5-vl-7b-instruct',    name: 'Qwen3.5 VL 7B',              contextWindow: 131072, supportsTools: false, supportsVision: true  },
    // ── Qwen3.5 Coder ─────────────────────────────────────────────────────────
    { id: 'qwen3.5-coder-32b-instruct',name: 'Qwen3.5 Coder 32B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-coder-14b-instruct',name: 'Qwen3.5 Coder 14B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3.5-coder-7b-instruct', name: 'Qwen3.5 Coder 7B',           contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── QwQ 3.5 — reasoning ───────────────────────────────────────────────────
    { id: 'qwq-3.5-235b-a22b',         name: 'QwQ 3.5 235B-A22B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwq-3.5-72b',               name: 'QwQ 3.5 72B',                 contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── Qwen3 — flagship MoE & dense ─────────────────────────────────────────
    { id: 'qwen3-235b-a22b',      name: 'Qwen3 235B-A22B',   contextWindow: 40960,  supportsTools: true,  supportsVision: false },
    { id: 'qwen3-235b-a22b-thinking', name: 'Qwen3 235B-A22B (thinking)', contextWindow: 40960, supportsTools: false, supportsVision: false },
    { id: 'qwen3-72b',            name: 'Qwen3 72B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3-72b-thinking',   name: 'Qwen3 72B (thinking)', contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3-32b',            name: 'Qwen3 32B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3-32b-thinking',   name: 'Qwen3 32B (thinking)', contextWindow: 131072, supportsTools: false, supportsVision: false },
    { id: 'qwen3-14b',            name: 'Qwen3 14B',          contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3-8b',             name: 'Qwen3 8B',           contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3-4b',             name: 'Qwen3 4B',           contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen3-1.7b',           name: 'Qwen3 1.7B',         contextWindow: 32768,  supportsTools: true,  supportsVision: false },
    { id: 'qwen3-0.6b',           name: 'Qwen3 0.6B',         contextWindow: 32768,  supportsTools: false, supportsVision: false },
    // ── Qwen3 VL — vision-language ────────────────────────────────────────────
    { id: 'qwen3-vl-72b-instruct', name: 'Qwen3 VL 72B',     contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen3-vl-7b-instruct',  name: 'Qwen3 VL 7B',      contextWindow: 131072, supportsTools: false, supportsVision: true  },
    // ── QwQ — reasoning series ────────────────────────────────────────────────
    { id: 'qwq-32b',              name: 'QwQ 32B',            contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwq-plus',             name: 'QwQ Plus',           contextWindow: 131072, supportsTools: true,  supportsVision: false },
    // ── Rolling aliases — always point to latest model ────────────────────────
    { id: 'qwen-max',             name: 'Qwen Max (→ Qwen3.7 flagship)',  contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwen-plus',            name: 'Qwen Plus (→ Qwen3.7 balanced)', contextWindow: 262144, supportsTools: true,  supportsVision: false },
    { id: 'qwen-turbo',           name: 'Qwen Turbo (→ Qwen3.7 fast)',    contextWindow: 1000000,supportsTools: true,  supportsVision: false },
    { id: 'qwen-long',            name: 'Qwen Long (1M ctx)',              contextWindow: 1000000,supportsTools: true,  supportsVision: false },
    // ── Qwen2.5 — pinned instruct ─────────────────────────────────────────────
    { id: 'qwen2.5-72b-instruct', name: 'Qwen2.5 72B',       contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen2.5-32b-instruct', name: 'Qwen2.5 32B',       contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen2.5-14b-instruct', name: 'Qwen2.5 14B',       contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen2.5-7b-instruct',  name: 'Qwen2.5 7B',        contextWindow: 131072, supportsTools: true,  supportsVision: false },
    { id: 'qwen2.5-3b-instruct',  name: 'Qwen2.5 3B',        contextWindow: 32768,  supportsTools: true,  supportsVision: false },
    // ── Qwen2.5 Coder ─────────────────────────────────────────────────────────
    { id: 'qwen2.5-coder-32b-instruct', name: 'Qwen2.5 Coder 32B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'qwen2.5-coder-14b-instruct', name: 'Qwen2.5 Coder 14B', contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'qwen2.5-coder-7b-instruct',  name: 'Qwen2.5 Coder 7B',  contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'qwen2.5-coder-3b-instruct',  name: 'Qwen2.5 Coder 3B',  contextWindow: 32768,  supportsTools: false, supportsVision: false },
    { id: 'qwen2.5-coder-1.5b-instruct',name: 'Qwen2.5 Coder 1.5B',contextWindow: 32768,  supportsTools: false, supportsVision: false },
    // ── Qwen2.5 VL — vision-language ──────────────────────────────────────────
    { id: 'qwen2.5-vl-72b-instruct', name: 'Qwen2.5 VL 72B',  contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen2.5-vl-32b-instruct', name: 'Qwen2.5 VL 32B',  contextWindow: 131072, supportsTools: true,  supportsVision: true  },
    { id: 'qwen2.5-vl-7b-instruct',  name: 'Qwen2.5 VL 7B',   contextWindow: 32768,  supportsTools: false, supportsVision: true  },
    { id: 'qwen2.5-vl-3b-instruct',  name: 'Qwen2.5 VL 3B',   contextWindow: 32768,  supportsTools: false, supportsVision: true  },
    { id: 'qwen2.5-vl-2b-instruct',  name: 'Qwen2.5 VL 2B',   contextWindow: 32768,  supportsTools: false, supportsVision: true  },
    // ── Qwen2.5 Math ──────────────────────────────────────────────────────────
    { id: 'qwen2.5-math-72b-instruct', name: 'Qwen2.5 Math 72B', contextWindow: 4096, supportsTools: false, supportsVision: false },
    { id: 'qwen2.5-math-7b-instruct',  name: 'Qwen2.5 Math 7B',  contextWindow: 4096, supportsTools: false, supportsVision: false },
    // ── Qwen2 Audio ───────────────────────────────────────────────────────────
    { id: 'qwen2-audio-instruct', name: 'Qwen2 Audio', contextWindow: 8192, supportsTools: false, supportsVision: false },
  ]

  constructor(apiKey: string) {
    super(apiKey, 'https://dashscope.aliyuncs.com/compatible-mode/v1')
  }
}
