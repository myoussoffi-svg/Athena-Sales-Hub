import { prisma } from "../src/lib/db";
import {
  ALTA_SYSTEM_PROMPT,
  ALTA_BUYER_SYSTEM_PROMPT,
} from "../prisma/prompts";

async function main() {
  const existing = await prisma.workspace.findUniqueOrThrow({
    where: { slug: "alta" },
    select: { settings: true },
  });
  const settings = {
    ...((existing.settings as Record<string, unknown>) ?? {}),
    buyerSystemPrompt: ALTA_BUYER_SYSTEM_PROMPT,
  };

  const ws = await prisma.workspace.update({
    where: { slug: "alta" },
    data: { aiSystemPrompt: ALTA_SYSTEM_PROMPT, settings },
    select: { name: true, slug: true },
  });
  console.log(
    `Synced Alta prompts to live DB (${ws.name} / ${ws.slug}): seller ${ALTA_SYSTEM_PROMPT.length} chars, buyer ${ALTA_BUYER_SYSTEM_PROMPT.length} chars.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
