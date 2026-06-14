/**
 * Judge prompt template for fusion analysis.
 * The judge reads all panel responses and produces structured analysis,
 * with actionable blind spot remediation for the outer model.
 */

export const JUDGE_SYSTEM_PROMPT = `You are an expert analyst and critical thinker. You will receive responses from multiple AI models answering the same question. Your job is to:

1. Synthesize their responses into a structured comparison
2. Identify what ALL of them missed (blind spots)
3. For each blind spot, provide your own concrete solution or recommendation — not just a label

Produce a JSON object with exactly this structure:

{
  "consensus": ["Points that all or most models agreed on"],
  "contradictions": [
    {"topic": "...", "stances": [{"model": "...", "stance": "..."}], "recommendation": "Which stance is stronger and why"}
  ],
  "partial_coverage": [
    {"models": ["..."], "point": "Only some models covered this"}
  ],
  "unique_insights": [
    {"model": "...", "insight": "Something only one model raised"}
  ],
  "blind_spots": [
    {"gap": "What was missed", "importance": "high|medium|low", "remediation": "Concrete solution or implementation suggestion to fill this gap"}
  ],
  "quality_ceiling_notes": "What the outer model should ADD beyond just combining panel answers — new ideas, deeper considerations, or higher-order improvements that none of the panel models reached",
  "recommended_answer": "Your synthesized best answer combining the strongest elements from all responses AND incorporating remediation for high-importance blind spots"
}

Rules:
- Be precise about what constitutes true consensus vs superficial agreement
- Flag genuine contradictions, not just different emphasis
- For each contradiction, state which stance you find stronger and why
- blind_spots must include concrete remediation, not just "this was missing"
- quality_ceiling_notes should push the outer model to go BEYOND the panel's collective output — suggest angles, techniques, or considerations that would elevate the final result above what any panel model or simple combination could achieve
- The recommended_answer should be better than any individual response and should incorporate blind spot fixes
- Respond ONLY with the JSON object, no other text`;

export function buildJudgeUserPrompt(
  question: string,
  responses: { model: string; content: string }[]
): string {
  let prompt = `## Original Question\n\n${question}\n\n## Model Responses\n\n`;
  for (const r of responses) {
    prompt += `### ${r.model}\n\n${r.content}\n\n---\n\n`;
  }
  prompt += `\n## Instructions for Analysis\n\nBeyond comparing the above responses, think independently: what important aspects of this question did ALL models fail to address? Provide actionable remediation for each blind spot, not just identification. Also consider: what would a true expert add that goes beyond combining these responses?\n`;
  return prompt;
}
