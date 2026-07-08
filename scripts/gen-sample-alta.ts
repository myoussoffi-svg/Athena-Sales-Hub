import { prisma } from "../src/lib/db";
import { generateEmail } from "../src/lib/claude";

async function main() {
  const ws = await prisma.workspace.findFirstOrThrow({
    where: { slug: "alta" },
    select: { aiSystemPrompt: true, settings: true },
  });
  const settings = (ws.settings as Record<string, unknown>) ?? {};
  const voiceProfile = (settings.voiceProfile as string) || undefined;

  const result = await generateEmail({
    workspaceSystemPrompt: ws.aiSystemPrompt,
    voiceProfile,
    contact: {
      name: "Mike Delgado",
      email: "mike@delgadoair.example",
      title: "Owner",
      organization: "Delgado Heating & Air",
      location: "Fresno, CA",
      researchData: {
        services: [
          "residential HVAC installation",
          "AC & furnace repair",
          "24/7 emergency service",
          "duct cleaning",
        ],
        yearsInBusiness: 18,
        teamSize: "about 12 technicians",
        serviceArea: "Fresno & the Central Valley",
        reputation: "4.8 stars across 340+ Google reviews",
        note: "Family-owned; founder Mike still runs day-to-day",
      },
    },
    campaignType: "HVAC",
    emailType: "initial",
  });

  console.log("\n================ GENERATED (voiceProfile: " + (voiceProfile ? "set" : "none") + ") ================");
  console.log("SUBJECT:      " + result.subject);
  console.log("VARIANT 2:    " + result.subjectVariants[1]);
  console.log("VARIANT 3:    " + result.subjectVariants[2]);
  console.log("HOOK:         " + result.hookUsed);
  console.log("SCORE/TONE:   " + result.personalizationScore + " / " + result.tone);
  console.log("--------------------------------------------------------");
  console.log(result.bodyPlain);
  console.log("========================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
