import { prisma } from "../src/lib/db";
import { researchWebsite } from "../src/lib/research-agent";
import { generateEmail } from "../src/lib/claude";

// Real, live service-business sites used only to verify the research scraper
// and generation. Nothing is persisted and nothing is sent.
const TARGETS = [
  { name: "Sam", org: "Mitchell Aire", url: "https://www.mitchellaire.com" },
  { name: "Angel", org: "D & S Mechanical", url: "https://www.dsplumbinghvac.com/" },
];

async function main() {
  const ws = await prisma.workspace.findFirstOrThrow({
    where: { slug: "alta" },
    select: { aiSystemPrompt: true },
  });

  for (const t of TARGETS) {
    console.log(`\n############ ${t.org} (${t.url}) ############`);
    const research = await researchWebsite(t.url);
    console.log("SCRAPED:");
    console.log("  companyName:", research.companyName);
    console.log("  description:", research.description?.slice(0, 140));
    console.log("  foundedYear:", research.foundedYear);
    console.log("  services:", research.services?.slice(0, 6));
    console.log("  keyMessaging:", research.keyMessaging?.slice(0, 120));
    console.log("  rawText length:", research.rawText.length);

    const email = await generateEmail({
      workspaceSystemPrompt: ws.aiSystemPrompt,
      contact: {
        name: t.name,
        email: `owner@example.com`,
        title: "Owner",
        organization: t.org,
        researchData: JSON.parse(JSON.stringify(research)),
      },
      campaignType: "HVAC",
      emailType: "initial",
    });

    console.log("\nDRAFT:");
    console.log("  SUBJECT:", email.subject);
    console.log("  HOOK:", email.hookUsed);
    console.log("  SCORE:", email.personalizationScore);
    console.log("  ----");
    console.log(email.bodyPlain.replace(/^/gm, "  "));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
