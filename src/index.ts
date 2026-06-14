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
  // --- Direct API providers ---
  "deepseek-v3": {
    id: "deepseek-v3", provider: "openai-compatible",
    model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  "deepseek-r1": {
    id: "deepseek-r1", provider: "openai-compatible",
    model: "deepseek-reasoner", baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  "gpt-4o": {
    id: "gpt-4o", provider: "openai-compatible",
    model: "gpt-4o", apiKeyEnv: "OPENAI_API_KEY",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash", provider: "google",
    model: "gemini-2.5-flash-preview-05-20", apiKeyEnv: "GOOGLE_API_KEY",
  },
  "claude-sonnet": {
    id: "claude-sonnet", provider: "anthropic",
    model: "claude-sonnet-4-20250514", apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  "claude-opus": {
    id: "claude-opus", provider: "anthropic",
    model: "claude-opus-4-20250514", apiKeyEnv: "ANTHROPIC_API_KEY",
  },
};

const DEFAULT_PANEL_IDS = ["deepseek-v4-pro", "kimi-k2.6", "glm-5.1"];
const DEFAULT_JUDGE_ID = "claude-sonnet";

// --- Parse custom config from env if provided ---

function loadConfig(panelIds?: string[], judgeId?: string): { panel: ModelConfig[]; judge: ModelConfig } {
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
  const resolvedPanel = (panelIds ?? DEFAULT_PANEL_IDS)
    .map((id) => MODEL_REGISTRY[id])
    .filter(Boolean);
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
  `Multi-model fusion analysis. Sends the query to multiple AI models in parallel, then a judge model synthesizes their responses into structured analysis (consensus, contradictions, unique insights, blind spots). Use this for complex research questions, multi-perspective analysis, or when accuracy is critical. Available panel models: ${Object.keys(MODEL_REGISTRY).join(", ")}. Default panel: ${DEFAULT_PANEL_IDS.join(", ")}. Default judge: ${DEFAULT_JUDGE_ID}.`,
  {
    query: z.string().describe("The question or prompt to analyze with multiple models"),
    panel_models: z
      .array(z.string())
      .optional()
      .describe(`Optional list of model IDs for the panel. Available: ${Object.keys(MODEL_REGISTRY).join(", ")}`),
    judge_model: z
      .string()
      .optional()
      .describe(`Optional judge model ID. Available: ${Object.keys(MODEL_REGISTRY).join(", ")}`),
  },
  async ({ query, panel_models, judge_model }) => {
    const fusionConfig = loadConfig(panel_models, judge_model);

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
