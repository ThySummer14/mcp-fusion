/**
 * Multi-provider API abstraction.
 * Supports: OpenAI-compatible (covers DeepSeek, Qwen, Kimi, Zhipu, etc.),
 * Anthropic, and Google Gemini.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export interface ModelConfig {
  id: string; // display name, e.g. "deepseek-v3"
  provider: "openai-compatible" | "anthropic" | "google" | "ark-openai" | "ark-anthropic";
  model: string; // actual model ID for the API
  baseUrl?: string; // for openai-compatible providers
  apiKeyEnv: string; // env var name holding the API key
}

export interface CompletionResult {
  model: string;
  content: string;
  error?: string;
}

export async function callModel(
  config: ModelConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<CompletionResult> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return { model: config.id, content: "", error: `Missing env: ${config.apiKeyEnv}` };
  }

  try {
    if (config.provider === "openai-compatible" || config.provider === "ark-openai") {
      const baseUrl = config.provider === "ark-openai"
        ? "https://ark.cn-beijing.volces.com/api/coding/v3"
        : config.baseUrl;
      return await callOpenAICompatible({ ...config, baseUrl }, apiKey, systemPrompt, userPrompt);
    } else if (config.provider === "anthropic" || config.provider === "ark-anthropic") {
      const baseURL = config.provider === "ark-anthropic"
        ? "https://ark.cn-beijing.volces.com/api/coding"
        : undefined;
      return await callAnthropic(config, apiKey, systemPrompt, userPrompt, baseURL);
    } else if (config.provider === "google") {
      return await callGoogle(config, apiKey, systemPrompt, userPrompt);
    }
    return { model: config.id, content: "", error: `Unknown provider: ${config.provider}` };
  } catch (err: any) {
    return { model: config.id, content: "", error: err.message ?? String(err) };
  }
}

async function callOpenAICompatible(
  config: ModelConfig,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<CompletionResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: config.baseUrl ?? "https://api.openai.com/v1",
  });
  const res = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });
  const content = res.choices[0]?.message?.content ?? "";
  return { model: config.id, content };
}

async function callAnthropic(
  config: ModelConfig,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  baseURL?: string
): Promise<CompletionResult> {
  const client = new Anthropic({
    apiKey,
    ...(baseURL && { baseURL }),
  });
  const res = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const content = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { model: config.id, content };
}

async function callGoogle(
  config: ModelConfig,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<CompletionResult> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: config.model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    },
  });
  const content = res.text ?? "";
  return { model: config.id, content };
}
