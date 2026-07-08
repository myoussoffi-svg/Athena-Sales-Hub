import { prisma } from "../src/lib/db";
import { ALTA_SYSTEM_PROMPT } from "../prisma/prompts";

async function main() {
  const ws = await prisma.workspace.update({
    where: { slug: "alta" },
    data: { aiSystemPrompt: ALTA_SYSTEM_PROMPT },
    select: { name: true, slug: true },
  });
  console.log(
    `Synced Alta system prompt to live DB (${ws.name} / ${ws.slug}), ${ALTA_SYSTEM_PROMPT.length} chars.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
