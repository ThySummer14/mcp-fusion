# MCP Fusion Server

多模型融合分析工具。将问题并行发送给多个 AI 模型，由评审模型综合各方观点，返回结构化分析。

## 安装

```bash
cd mcp-fusion
npm install
npm run build
```

## 在 Claude Code 中配置

在项目 `.mcp.json` 或全局 `~/.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "fusion": {
      "command": "node",
      "args": ["/Users/thysummer/Desktop/some thing/agent/Claude code/mcp-fusion/dist/index.js"],
      "env": {
        "ARK_API_KEY": "你的字节方舟CodingPlan key",
        "ANTHROPIC_API_KEY": "你的Anthropic key"
      }
    }
  }
}
```

只需要 `ARK_API_KEY` + `ANTHROPIC_API_KEY` 就能跑起来（面板走方舟，评审走 Claude）。

如果还想在面板中加入 GPT 或 Gemini，额外配置对应 key 即可。

## 可用模型

通过 CodingPlan（一个 ARK key）：
- `doubao-seed-2.0-pro` — 字节豆包
- `deepseek-v4-pro` — DeepSeek
- `deepseek-v4-flash` — DeepSeek 快速版
- `kimi-k2.6` — 月之暗面
- `glm-5.1` — 智谱
- `minimax-m3` — MiniMax

通过各自官方 key：
- `gpt-4o` — OpenAI
- `gemini-2.5-flash` — Google
- `claude-sonnet` — Anthropic
- `claude-opus` — Anthropic

## 默认配置

- 面板：`deepseek-v4-pro` + `kimi-k2.6` + `glm-5.1`
- 评审：`claude-sonnet`

## 自定义使用

调用时可以指定面板和评审模型：

```
"用 fusion 分析这个问题，面板用 deepseek-v4-pro、gpt-4o、kimi-k2.6，评审用 claude-opus"
```

tool 参数：
- `query` — 要分析的问题
- `panel_models` — 可选，面板模型 ID 列表
- `judge_model` — 可选，评审模型 ID
