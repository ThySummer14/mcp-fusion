import { runFusion } from "./dist/fusion.js";

const panel = [
  { id: "deepseek-v4-pro", provider: "ark-openai", model: "deepseek-v4-pro", apiKeyEnv: "ARK_API_KEY" },
  { id: "kimi-k2.6", provider: "ark-openai", model: "kimi-k2.6", apiKeyEnv: "ARK_API_KEY" },
  { id: "glm-5.1", provider: "ark-openai", model: "glm-5.1", apiKeyEnv: "ARK_API_KEY" },
];

const judge = { id: "deepseek-v4-pro-direct", provider: "openai-compatible", model: "deepseek-v4-pro", baseUrl: "https://api.deepseek.com", apiKeyEnv: "DEEPSEEK_API_KEY" };

process.env.ARK_API_KEY = "ark-8561555d-5c33-44b5-a081-28ee29cc3c3b-d06ab";
process.env.DEEPSEEK_API_KEY = "sk-f1c73e457819482db3bb7f63bde094f6";

console.log("Starting fusion with 3 panel models...\n");

const result = await runFusion(
  "设计一个单页网站，要求有高级感和电影质感。请提供具体的设计方案：配色方案、布局结构、动效建议、字体选择、关键CSS技巧。给出可直接使用的HTML/CSS代码片段。",
  { panel, judge }
);

console.log("Status:", result.status);
console.log("\n=== ANALYSIS ===\n");
console.log(JSON.stringify(result.analysis, null, 2));
console.log("\n=== PANEL RESPONSES (truncated) ===\n");
for (const r of result.responses) {
  console.log(`--- ${r.model} ---`);
  console.log(r.content.slice(0, 500) + "...\n");
}
if (result.failed_models?.length) {
  console.log("Failed:", result.failed_models);
}
