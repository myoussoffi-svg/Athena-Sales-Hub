import Anthropic from "@anthropic-ai/sdk";

// ─── Types ──────────────────────────────────────────────────────────

interface EmailGenerationInput {
  workspaceSystemPrompt: string;
  voiceProfile?: string;
  contact: {
    name: string;
    email: string;
    title?: string;
    organization?: string;
    orgType?: string;
    location?: string;
    notes?: string;
    researchData?: Record<string, unknown>;
  };
  campaignType: string;
  emailType: "initial" | "followup_1" | "followup_2" | "meeting_request";
  previousEmails?: Array<{
    type: string;
    subject: string;
    bodyPlain: string;
    sentAt: string;
  }>;
  customInstructions?: string;
}

interface GeneratedEmail {
  subject: string;
  subjectVariants: string[];
  bodyHtml: string;
  bodyPlain: string;
  hookUsed: string;
  personalizationScore: "low" | "medium" | "high";
  tone: string;
}

// ─── Tool Definitions ───────────────────────────────────────────────

const GENERATE_EMAIL_TOOL: Anthropic.Tool = {
  name: "generate_email",
  description:
    "Generate a personalized outreach email for the given contact and campaign context.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: {
        type: "string",
        description:
          "Email subject line - compelling but not clickbaity. Should feel personal and relevant.",
      },
      subject_variant_2: {
        type: "string",
        description:
          "Alternative subject line option with a different angle or hook.",
      },
      subject_variant_3: {
        type: "string",
        description:
          "Another alternative subject line, more concise or direct.",
      },
      body_html: {
        type: "string",
        description:
          "HTML formatted email body. MUST wrap each paragraph in <p>...</p> tags. Example: '<p>Hi John,</p><p>First paragraph here.</p><p>Second paragraph.</p><p>Best,<br>Team</p>'. Keep concise — 3-5 short paragraphs max. No images or complex HTML. Do NOT use plain text with newlines.",
      },
      body_plain: {
        type: "string",
        description:
          "Plain text version of the email. Same content as body_html but without any HTML tags.",
      },
      hook_used: {
        type: "string",
        description:
          "Brief description of the personalization hook used (e.g. 'Referenced their recent expansion to Austin' or 'Connected their healthcare focus to our nursing talent pipeline').",
      },
      personalization_score: {
        type: "string",
        enum: ["low", "medium", "high"],
        description:
          "How personalized is this email? 'high' = references specific details about the contact/org. 'medium' = references their industry or role. 'low' = mostly generic.",
      },
      tone: {
        type: "string",
        description:
          "One or two words describing the tone (e.g. 'warm professional', 'direct', 'consultative', 'friendly casual').",
      },
    },
    required: [
      "subject",
      "subject_variant_2",
      "subject_variant_3",
      "body_html",
      "body_plain",
      "hook_used",
      "personalization_score",
      "tone",
    ],
  },
};

const CLASSIFY_REPLY_TOOL: Anthropic.Tool = {
  name: "classify_reply",
  description:
    "Classify the sentiment of a reply to an outreach email and generate a suggested response.",
  input_schema: {
    type: "object" as const,
    properties: {
      sentiment: {
        type: "string",
        enum: [
          "interested",
          "maybe_later",
          "not_interested",
          "out_of_office",
          "wrong_person",
        ],
        description:
          "The primary sentiment or intent of the reply. 'interested' = wants to learn more or schedule a call. 'maybe_later' = not now but open to future contact. 'not_interested' = clear rejection. 'out_of_office' = auto-reply or away message. 'wrong_person' = they are not the right contact.",
      },
      suggested_reply: {
        type: "string",
        description:
          "A suggested reply draft appropriate for the sentiment. Keep concise and professional. For 'interested', propose next steps. For 'maybe_later', acknowledge and set a follow-up timeframe. For 'not_interested', thank them gracefully. For 'out_of_office', note to retry later. For 'wrong_person', ask for a referral.",
      },
    },
    required: ["sentiment", "suggested_reply"],
  },
};

// ─── Email Type Labels ──────────────────────────────────────────────

const EMAIL_TYPE_INSTRUCTIONS: Record<string, string> = {
  initial:
    "This is the FIRST outreach to this contact. Make a strong first impression. Lead with value, not a pitch. Reference something specific about them or their organization.",
  followup_1:
    "This is the FIRST FOLLOW-UP (sent ~5 days after initial). Keep it short. Reference the previous email without being pushy. Add a new angle or piece of value. Do NOT repeat the same pitch.",
  followup_2:
    "This is the SECOND FOLLOW-UP (sent ~14 days after initial). This is likely your last chance. Be direct about the value proposition. Consider a different approach — a question, a case study reference, or a breakup-style message.",
  meeting_request:
    "This is a MEETING REQUEST. The contact has shown interest. Propose specific times, keep it action-oriented, and make it easy to say yes.",
};

// ─── Core: Generate Email ───────────────────────────────────────────

export async function generateEmail(
  input: EmailGenerationInput,
): Promise<GeneratedEmail> {
  const client = new Anthropic();

  // Build system prompt layers
  const systemParts: string[] = [input.workspaceSystemPrompt];

  if (input.voiceProfile) {
    systemParts.push(
      `\n\n## VOICE PROFILE\nMatch this writing style closely:\n${input.voiceProfile}`,
    );
  }

  systemParts.push(`\n\n## EMAIL GUIDELINES
- Write like a real person, not a marketing bot
- NEVER use em dashes. Use commas, periods, or "and" instead.
- Keep emails 150-250 words for initial outreach, under 100 for follow-ups
- Use the contact's first name only (not full name), or just "Hi," if no personalized opener fits
- No generic openers like "I hope this email finds you well"
- No excessive exclamation marks (one at most in the entire email)
- Include a clear but soft call-to-action
- Subject lines: 4-8 words, no ALL CAPS, no spam trigger words`);

  const systemPrompt = systemParts.join("");

  // Build user message with all context
  const contactFirstName = input.contact.name.split(" ")[0];
  const userMessageParts: string[] = [];

  userMessageParts.push(`## TASK
Generate a ${input.emailType.replace("_", " ")} email for the following contact.
Campaign type: ${input.campaignType}

${EMAIL_TYPE_INSTRUCTIONS[input.emailType] ?? ""}`);

  if (input.customInstructions) {
    userMessageParts.push(
      `\n## CUSTOM INSTRUCTIONS\n${input.customInstructions}`,
    );
  }

  userMessageParts.push(`\n## CONTACT DETAILS
- Name: ${input.contact.name} (use "${contactFirstName}" in the email)
- Email: ${input.contact.email}${input.contact.title ? `\n- Title: ${input.contact.title}` : ""}${input.contact.organization ? `\n- Organization: ${input.contact.organization}` : ""}${input.contact.orgType ? `\n- Org Type: ${input.contact.orgType}` : ""}${input.contact.location ? `\n- Location: ${input.contact.location}` : ""}${input.contact.notes ? `\n- Notes: ${input.contact.notes}` : ""}`);

  if (
    input.contact.researchData &&
    Object.keys(input.contact.researchData).length > 0
  ) {
    userMessageParts.push(
      `\n## RESEARCH DATA (from their website)\n${JSON.stringify(input.contact.researchData, null, 2)}`,
    );
  }

  if (input.previousEmails && input.previousEmails.length > 0) {
    userMessageParts.push(`\n## PREVIOUS EMAILS IN THIS THREAD`);
    for (const prev of input.previousEmails) {
      userMessageParts.push(
        `\n### ${prev.type} (sent ${prev.sentAt})\nSubject: ${prev.subject}\n${prev.bodyPlain}`,
      );
    }
  }

  userMessageParts.push(
    `\nGenerate the email now using the generate_email tool.`,
  );

  const userMessage = userMessageParts.join("\n");

  // Call Claude with retry logic
  let temperature = 0.7;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        temperature,
        system: systemPrompt,
        tools: [GENERATE_EMAIL_TOOL],
        tool_choice: { type: "tool", name: "generate_email" },
        messages: [{ role: "user", content: userMessage }],
      });

      // Extract the tool use block
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (!toolUseBlock) {
        throw new Error(
          "[claude] No tool_use block in response. Stop reason: " +
            response.stop_reason,
        );
      }

      if (toolUseBlock.name !== "generate_email") {
        throw new Error(
          `[claude] Unexpected tool name: ${toolUseBlock.name}. Expected generate_email.`,
        );
      }

      const toolInput = toolUseBlock.input as Record<string, unknown>;

      // Validate required fields
      const requiredFields = [
        "subject",
        "subject_variant_2",
        "subject_variant_3",
        "body_html",
        "body_plain",
        "hook_used",
        "personalization_score",
        "tone",
      ];

      for (const field of requiredFields) {
        if (!toolInput[field] && toolInput[field] !== "") {
          throw new Error(
            `[claude] Missing required field in tool response: ${field}`,
          );
        }
      }

      const personalizationScore = toolInput.personalization_score as string;
      if (!["low", "medium", "high"].includes(personalizationScore)) {
        throw new Error(
          `[claude] Invalid personalization_score: ${personalizationScore}. Expected low, medium, or high.`,
        );
      }

      // Safety net: convert plain text to HTML if Claude didn't use tags
      let bodyHtml = toolInput.body_html as string;
      if (!/<[a-z][\s\S]*>/i.test(bodyHtml)) {
        bodyHtml = bodyHtml
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");
      }

      return {
        subject: toolInput.subject as string,
        subjectVariants: [
          toolInput.subject as string,
          toolInput.subject_variant_2 as string,
          toolInput.subject_variant_3 as string,
        ],
        bodyHtml,
        bodyPlain: toolInput.body_plain as string,
        hookUsed: toolInput.hook_used as string,
        personalizationScore: personalizationScore as
          | "low"
          | "medium"
          | "high",
        tone: toolInput.tone as string,
      };
    } catch (error) {
      // On first attempt failure with an API error, retry with lower temperature
      if (attempts < maxAttempts) {
        console.warn(
          `[claude] Email generation attempt ${attempts} failed, retrying with temperature 0.5:`,
          error instanceof Error ? error.message : error,
        );
        temperature = 0.5;
        continue;
      }

      // Second attempt also failed — re-throw
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("[claude] Email generation failed after all retry attempts");
}

// ─── Reply Classification ───────────────────────────────────────────

export async function classifyReplySentiment(
  replyText: string,
  originalEmail: string,
): Promise<{ sentiment: string; suggestedReply: string }> {
  const client = new Anthropic();

  const systemPrompt = `You are an expert at analyzing email replies to sales/recruiting outreach.
Your job is to classify the intent and sentiment of the reply, and draft an appropriate response.

Classification guidelines:
- "interested": They want to learn more, asked a question, or are open to a conversation
- "maybe_later": They acknowledge the email but say "not right now", "check back later", "busy this quarter"
- "not_interested": Clear rejection — "not interested", "please remove me", "we don't need this"
- "out_of_office": Auto-reply, vacation message, or similar automated response
- "wrong_person": They say they aren't the right contact, or suggest someone else

When drafting a suggested reply:
- Match the tone and energy of the original outreach
- Keep it concise (2-3 sentences max)
- Be gracious regardless of sentiment`;

  const userMessage = `## ORIGINAL OUTREACH EMAIL
${originalEmail}

## THEIR REPLY
${replyText}

Classify this reply and draft a suggested response using the classify_reply tool.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    temperature: 0.3,
    system: systemPrompt,
    tools: [CLASSIFY_REPLY_TOOL],
    tool_choice: { type: "tool", name: "classify_reply" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUseBlock) {
    throw new Error(
      "[claude] No tool_use block in classify reply response. Stop reason: " +
        response.stop_reason,
    );
  }

  if (toolUseBlock.name !== "classify_reply") {
    throw new Error(
      `[claude] Unexpected tool name: ${toolUseBlock.name}. Expected classify_reply.`,
    );
  }

  const toolInput = toolUseBlock.input as Record<string, unknown>;

  if (!toolInput.sentiment || !toolInput.suggested_reply) {
    throw new Error(
      "[claude] Malformed classify_reply response — missing sentiment or suggested_reply",
    );
  }

  const validSentiments = [
    "interested",
    "maybe_later",
    "not_interested",
    "out_of_office",
    "wrong_person",
  ];

  if (!validSentiments.includes(toolInput.sentiment as string)) {
    throw new Error(
      `[claude] Invalid sentiment: ${toolInput.sentiment}. Expected one of: ${validSentiments.join(", ")}`,
    );
  }

  return {
    sentiment: toolInput.sentiment as string,
    suggestedReply: toolInput.suggested_reply as string,
  };
}
