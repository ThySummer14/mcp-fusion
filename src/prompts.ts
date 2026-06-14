/**
 * Judge prompt template for fusion analysis.
 * The judge reads all panel responses and produces structured analysis.
 */

export const JUDGE_SYSTEM_PROMPT = `You are an expert analyst. You will receive responses from multiple AI models answering the same question. Your job is to synthesize their responses into a structured analysis.

Analyze the responses and produce a JSON object with exactly this structure:

{
  "consensus": ["Points that all or most models agreed on"],
  "contradictions": [
    {"topic": "...", "stances": [{"model": "...", "stance": "..."}]}
  ],
  "partial_coverage": [
    {"models": ["..."], "point": "Only some models covered this"}
  ],
  "unique_insights": [
    {"model": "...", "insight": "Something only one model raised"}
  ],
  "blind_spots": ["Important aspects no model addressed"],
  "recommended_answer": "Your synthesized best answer combining the strongest elements from all responses"
}

Rules:
- Be precise about what constitutes true consensus vs superficial agreement
- Flag genuine contradictions, not just different emphasis
- The recommended_answer should be better than any individual response
- Keep blind_spots honest — if the models collectively missed something important, say so
- Respond ONLY with the JSON object, no other text`;

export function buildJudgeUserPrompt(
  question: string,
  responses: { model: string; content: string }[]
): string {
  let prompt = `## Original Question\n\n${question}\n\n## Model Responses\n\n`;
  for (const r of responses) {
    prompt += `### ${r.model}\n\n${r.content}\n\n---\n\n`;
  }
  return prompt;
}
