#!/usr/bin/env node
/**
 * MCP Fusion Server
 * Exposes a "fusion" tool that runs multi-model deliberation.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runFusion, FusionConfig } from "./fusion.js";
import { ModelConfig } from "./providers.js";

// --- Default model configurations (override via env) ---

// All available models (registered pool). The default panel picks from these.
const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // --- ByteDance CodingPlan (one ARK key, multiple models) ---
  "doubao-seed-2.0-pro": {
    id: "doubao-seed-2.0-pro", provider: "ark-openai",
    model: "doubao-seed-2.0-pro", apiKeyEnv: "ARK_API_KEY",
  },
  "doubao-seed-2.0-lite": {
    id: "doubao-seed-2.0-lite", provider: "ark-openai",
    model: "doubao-seed-2.0-lite", apiKeyEnv: "ARK_API_KEY",
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro", provider: "ark-openai",
    model: "deepseek-v4-pro", apiKeyEnv: "ARK_API_KEY",
  },
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash", provider: "ark-openai",
    model: "deepseek-v4-flash", apiKeyEnv: "ARK_API_KEY",
  },
  "kimi-k2.6": {
    id: "kimi-k2.6", provider: "ark-openai",
    model: "kimi-k2.6", apiKeyEnv: "ARK_API_KEY",
  },
  "glm-5.1": {
    id: "glm-5.1", provider: "ark-openai",
    model: "glm-5.1", apiKeyEnv: "ARK_API_KEY",
  },
  "minimax-m3": {
    id: "minimax-m3", provider: "ark-openai",
    model: "minimax-m3", apiKeyEnv: "ARK_API_KEY",
  },
  // --- DeepSeek official direct API ---
  "deepseek-v4-flash-direct": {
    id: "deepseek-v4-flash-direct", provider: "openai-compatible",
    model: "deepseek-v4-flash", baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  "deepseek-v4-pro-direct": {
    id: "deepseek-v4-pro-direct", provider: "openai-compatible",
    model: "deepseek-v4-pro", baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  // --- Optional: international providers (if keys available) ---
  "gpt-4o": {
    id: "gpt-4o", provider: "openai-compatible",
    model: "gpt-4o", apiKeyEnv: "OPENAI_API_KEY",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash", provider: "google",
    model: "gemini-2.5-flash-preview-05-20", apiKeyEnv: "GOOGLE_API_KEY",
  },
};

// Defaults: all-domestic, no Anthropic needed
const DEFAULT_PANEL_IDS = ["deepseek-v4-pro", "kimi-k2.6", "glm-5.1"];
const DEFAULT_JUDGE_ID = "deepseek-v4-pro-direct";

// --- Parse custom config from env if provided ---

function loadConfig(panelIds?: string[], judgeId?: string, panelCount?: number): { panel: ModelConfig[]; judge: ModelConfig } {
  // Env overrides (JSON format) take highest priority
  const envPanel = process.env.FUSION_PANEL;
  const envJudge = process.env.FUSION_JUDGE;

  if (envPanel || envJudge) {
    let panel: ModelConfig[] = DEFAULT_PANEL_IDS.map((id) => MODEL_REGISTRY[id]).filter(Boolean);
    let judge: ModelConfig = MODEL_REGISTRY[DEFAULT_JUDGE_ID];
    if (envPanel) { try { panel = JSON.parse(envPanel); } catch { /* use default */ } }
    if (envJudge) { try { judge = JSON.parse(envJudge); } catch { /* use default */ } }
    return { panel, judge };
  }

  // Tool-call overrides (by model ID from registry)
  let resolvedPanel: ModelConfig[];

  if (panelIds && panelIds.length > 0) {
    // Support duplicate model IDs for self-fusion (e.g. ["deepseek-v4-pro", "deepseek-v4-pro", "deepseek-v4-pro"])
    resolvedPanel = panelIds
      .map((id) => MODEL_REGISTRY[id])
      .filter(Boolean);
  } else {
    resolvedPanel = DEFAULT_PANEL_IDS.map((id) => MODEL_REGISTRY[id]).filter(Boolean);
  }

  // If panelCount > panel length, duplicate the panel models to reach the count (for self-fusion)
  if (panelCount && panelCount > resolvedPanel.length && resolvedPanel.length > 0) {
    while (resolvedPanel.length < panelCount) {
      resolvedPanel.push(resolvedPanel[resolvedPanel.length % resolvedPanel.length]);
    }
  }

  const resolvedJudge = MODEL_REGISTRY[judgeId ?? DEFAULT_JUDGE_ID] ?? MODEL_REGISTRY[DEFAULT_JUDGE_ID];

  return {
    panel: resolvedPanel.length > 0 ? resolvedPanel : DEFAULT_PANEL_IDS.map((id) => MODEL_REGISTRY[id]).filter(Boolean),
    judge: resolvedJudge,
  };
}

// --- MCP Server setup ---

const server = new McpServer({
  name: "fusion",
  version: "0.1.0",
});

server.tool(
  "fusion",
  `多模型融合分析。将问题并行发送给多个AI模型，由评审模型综合各方观点，返回结构化分析（共识、矛盾、独特洞察、盲区）。适用于复杂研究问题、多角度分析、或对准确性要求高的场景。支持同模型自融合（同一模型跑多次再合成）。可用模型: ${Object.keys(MODEL_REGISTRY).join(", ")}。默认面板: ${DEFAULT_PANEL_IDS.join(", ")}。默认评审: ${DEFAULT_JUDGE_ID}。`,
  {
    query: z.string().describe("要分析的问题"),
    panel_models: z
      .array(z.string())
      .optional()
      .describe(`面板模型ID列表，可重复同一模型实现自融合。可用: ${Object.keys(MODEL_REGISTRY).join(", ")}`),
    panel_count: z
      .number()
      .optional()
      .describe("面板并行调用次数（用于自融合，如指定3则同一模型跑3次）"),
    judge_model: z
      .string()
      .optional()
      .describe(`评审模型ID。可用: ${Object.keys(MODEL_REGISTRY).join(", ")}`),
  },
  async ({ query, panel_models, panel_count, judge_model }) => {
    const fusionConfig = loadConfig(panel_models, judge_model, panel_count);

    const result = await runFusion(query, fusionConfig);

    // Format output for the calling model
    let text: string;
    if (result.status === "error") {
      text = `Fusion failed: ${result.error}\n\nFailed models:\n${JSON.stringify(result.failed_models, null, 2)}`;
    } else {
      text = JSON.stringify(
        {
          status: result.status,
          analysis: result.analysis,
          panel_responses: result.responses.map((r) => ({
            model: r.model,
            content: r.content.slice(0, 3000), // truncate for context
          })),
          ...(result.failed_models && { failed_models: result.failed_models }),
        },
        null,
        2
      );
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fusion server failed to start:", err);
  process.exit(1);
});
