import Anthropic from "@anthropic-ai/sdk";

export interface PressReleaseContact {
  name: string;
  title: string;
  firm: string;
  sourceType: "sponsor_investment_professional" | "portco_executive";
  sourceUrl?: string;
}

interface ExtractContactInput {
  sponsor: string;
  target?: string | null;
  platform?: string | null;
  dealType: string;
  announcedDate: Date;
  headline: string;
}

const RECORD_CONTACT_TOOL: Anthropic.Tool = {
  name: "record_contact",
  description:
    "Record the quoted contact found in the deal's press release, or report that none was found.",
  input_schema: {
    type: "object",
    properties: {
      found: {
        type: "boolean",
        description:
          "Whether a quoted person was found in an actual press release or news article about this deal.",
      },
      name: { type: "string", description: "Full name of the quoted person." },
      title: {
        type: "string",
        description: "Their title, e.g. 'Partner' or 'CEO'.",
      },
      firm: {
        type: "string",
        description:
          "The firm the quoted person belongs to (the PE sponsor, or the target/platform company).",
      },
      source_type: {
        type: "string",
        enum: ["sponsor_investment_professional", "portco_executive"],
        description:
          "'sponsor_investment_professional' if the quote is from an investment professional at the PE sponsor firm (Partner, Principal, Managing Director, VP). 'portco_executive' if it's from an executive at the acquired/target/platform company (CEO, President, Founder) because no sponsor-side quote was available.",
      },
      source_url: {
        type: "string",
        description: "URL of the press release or article the quote came from.",
      },
    },
    required: ["found"],
  },
};

/**
 * Buyout Desk's own deal summary has no quotes (verified: it's a 1-line
 * tracker entry, not the underlying announcement). This searches the web for
 * the actual press release behind a deal and extracts a quoted contact to
 * reach out to, preferring an investment professional at the PE sponsor over
 * a portco executive.
 */
export async function extractPressReleaseContact(
  input: ExtractContactInput,
): Promise<PressReleaseContact | null> {
  const client = new Anthropic();

  const dealDesc = [
    `Sponsor (PE firm): ${input.sponsor}`,
    input.target ? `Target/acquired company: ${input.target}` : null,
    input.platform && input.platform !== input.target
      ? `Platform: ${input.platform}`
      : null,
    `Deal type: ${input.dealType}`,
    `Announced: ${input.announcedDate.toISOString().slice(0, 10)}`,
    `Headline: ${input.headline}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You find the actual press release or news announcement behind a private equity acquisition, and identify a quoted contact from it.

Search the web for the real press release or news coverage of this deal (not a deal-tracker summary). Once found, identify a person quoted in it, in this priority order:
1. STRONGLY PREFERRED: an investment professional at the PE sponsor firm (Partner, Principal, Managing Director, Vice President).
2. FALLBACK: if no sponsor-side quote exists, an executive at the acquired/target/platform company (CEO, President, Founder).

Only report a real person actually quoted in a real source you found via search. Never invent a name, title, or quote. If you search and cannot find any press release with a quoted person, call record_contact with found=false.

Call record_contact exactly once with your result.`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Find the press release for this deal and the quoted contact:\n\n${dealDesc}` },
  ];

  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20250305", name: "web_search" },
    RECORD_CONTACT_TOOL,
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: systemPrompt,
    tools,
    tool_choice: { type: "auto" },
    messages,
  });

  // Long-running search loops can hit the internal server-tool iteration cap
  // (stop_reason: "pause_turn"); resume once by re-sending the paused turn.
  if (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      tool_choice: { type: "auto" },
      messages,
    });
  }

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "record_contact",
  );
  if (!toolUseBlock) return null;

  const result = toolUseBlock.input as Record<string, unknown>;
  if (!result.found) return null;

  const name = result.name as string | undefined;
  const title = result.title as string | undefined;
  const firm = result.firm as string | undefined;
  const sourceType = result.source_type as string | undefined;
  if (
    !name ||
    !title ||
    !firm ||
    (sourceType !== "sponsor_investment_professional" &&
      sourceType !== "portco_executive")
  ) {
    return null;
  }

  return {
    name,
    title,
    firm,
    sourceType,
    sourceUrl: result.source_url as string | undefined,
  };
}
