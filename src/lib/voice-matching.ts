import Anthropic from "@anthropic-ai/sdk";

// ─── Voice Profile Generation ───────────────────────────────────────

/**
 * Analyzes an array of email writing samples and produces a concise
 * voice profile description that can be injected into email generation
 * prompts to match the author's writing style.
 *
 * Ideally 5-15 samples for a reliable profile. Fewer samples will
 * produce a less accurate profile; more than 15 will be truncated.
 */
export async function generateVoiceProfile(
  samples: string[],
): Promise<string> {
  if (samples.length === 0) {
    throw new Error(
      "[voice-matching] At least one writing sample is required to generate a voice profile",
    );
  }

  const client = new Anthropic();

  // Cap at 15 samples to stay within context limits
  const usedSamples = samples.slice(0, 15);

  const systemPrompt = `You are an expert linguistic analyst specializing in writing style analysis.
Your task is to analyze email writing samples and produce a concise, actionable voice profile
that another AI can use to mimic this writing style when generating outreach emails.

Your analysis should capture:
1. **Sentence structure**: Average sentence length (short/medium/long), use of fragments, complexity
2. **Formality level**: Very formal, professional, conversational, casual, etc.
3. **Opening patterns**: How they start emails (direct ask, warm greeting, context-setting, etc.)
4. **Closing patterns**: How they end emails (call-to-action style, sign-off phrases, warmth level)
5. **Tone**: Confident, humble, enthusiastic, measured, witty, earnest, etc.
6. **Vocabulary patterns**: Simple vs. sophisticated words, industry jargon usage, filler phrases
7. **Humor/personality**: Do they use humor? Analogies? Rhetorical questions? Exclamation marks?
8. **Paragraph style**: Short punchy paragraphs vs. longer blocks, use of line breaks

Output a 2-3 paragraph voice profile written as direct instructions. Start each paragraph with
an actionable directive. For example: "Write in short, direct sentences..." or "Open emails with..."

Do NOT list the categories above. Write it as flowing, natural prose that can be dropped into a prompt.`;

  const userMessage = `Here are ${usedSamples.length} email writing samples from the same author. Analyze them and produce the voice profile.

${usedSamples
  .map(
    (sample, i) => `--- SAMPLE ${i + 1} ---
${sample.trim()}`,
  )
  .join("\n\n")}

Now produce the voice profile (2-3 paragraphs of actionable writing style instructions).`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text from response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );

  if (!textBlock || !textBlock.text.trim()) {
    throw new Error(
      "[voice-matching] Claude returned an empty voice profile response",
    );
  }

  return textBlock.text.trim();
}
