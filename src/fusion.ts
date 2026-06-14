/**
 * Core fusion orchestration: parallel panel calls + judge synthesis.
 */

import { ModelConfig, CompletionResult, callModel } from "./providers.js";
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from "./prompts.js";

export interface FusionConfig {
  panel: ModelConfig[];
  judge: ModelConfig;
}

export interface FusionResult {
  status: "ok" | "error";
  analysis?: any;
  responses: CompletionResult[];
  failed_models?: CompletionResult[];
  error?: string;
}

export async function runFusion(
  question: string,
  config: FusionConfig
): Promise<FusionResult> {
  // Step 1: Call all panel models in parallel
  const panelPromises = config.panel.map((m) =>
    callModel(m, "You are a helpful assistant. Answer thoroughly and accurately.", question)
  );
  const allResults = await Promise.all(panelPromises);

  const succeeded = allResults.filter((r) => !r.error && r.content);
  const failed = allResults.filter((r) => !!r.error);

  if (succeeded.length === 0) {
    return {
      status: "error",
      responses: [],
      failed_models: failed,
      error: "All panel models failed",
    };
  }

  // Step 2: Judge synthesizes the responses
  const judgeInput = buildJudgeUserPrompt(question, succeeded);
  const judgeResult = await callModel(config.judge, JUDGE_SYSTEM_PROMPT, judgeInput);

  if (judgeResult.error || !judgeResult.content) {
    // Judge failed — return raw panel responses without analysis
    return {
      status: "ok",
      responses: succeeded,
      ...(failed.length > 0 && { failed_models: failed }),
    };
  }

  // Step 3: Parse judge output
  let analysis: any;
  try {
    // Extract JSON from judge response (may be wrapped in markdown code block)
    const jsonStr = judgeResult.content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    analysis = JSON.parse(jsonStr);
  } catch {
    // If JSON parsing fails, include raw judge output
    analysis = { raw_judge_output: judgeResult.content };
  }

  return {
    status: "ok",
    analysis,
    responses: succeeded,
    ...(failed.length > 0 && { failed_models: failed }),
  };
}
