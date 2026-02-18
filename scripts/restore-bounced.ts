import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

const bouncedContacts = [
  { name: "Columbia Investment Banking Division (Columbia)", email: "columbiainvestmentbanking@gmail.com" },
  { name: "Stern Finance Society (NYU)", email: "sternfinancesociety@gmail.com" },
  { name: "Michigan Investment Banking Club (Michigan)", email: "umichibclub@umich.edu" },
  { name: "Michigan Finance Club (Michigan)", email: "michiganfinclub@umich.edu" },
  { name: "University Finance Association (UT Austin)", email: "ufa@utexas.edu" },
  { name: "Cornell Undergraduate Finance Club (Cornell)", email: "cornellufc@gmail.com" },
  { name: "Northwestern Investment Banking Club (Northwestern)", email: "northwesternibclub@gmail.com" },
  { name: "Northwestern Finance Club (Northwestern)", email: "northwesternfinanceclub@gmail.com" },
  { name: "Notre Dame Investment Club (Notre Dame)", email: "ndinvestclub@gmail.com" },
  { name: "Investment Banking Workshop (Indiana University)", email: "ibw@indiana.edu" },
  { name: "Nittany Lion Fund (Penn State)", email: "nlf@psu.edu" },
  { name: "Finance & Investment Club (Boston University)", email: "bufic@bu.edu" },
];

async function main() {
  const campaign = await prisma.campaign.findFirst({
    where: { name: "School Org Outreach" },
  });

  if (!campaign) {
    console.error("Could not find 'School Org Outreach' campaign");
    process.exit(1);
  }

  console.log(`Found campaign: ${campaign.name} (${campaign.id}), workspace: ${campaign.workspaceId}`);

  let created = 0;
  for (const contact of bouncedContacts) {
    const existing = await prisma.contact.findFirst({
      where: { email: contact.email, workspaceId: campaign.workspaceId },
    });

    if (existing) {
      console.log(`  Skipping ${contact.email} (already exists)`);
      continue;
    }

    await prisma.contact.create({
      data: {
        name: contact.name,
        email: contact.email,
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        status: "BOUNCED",
      },
    });

    console.log(`  Created: ${contact.name} (${contact.email}) — BOUNCED`);
    created++;
  }

  console.log(`\nDone. Created ${created} bounced contacts.`);
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
