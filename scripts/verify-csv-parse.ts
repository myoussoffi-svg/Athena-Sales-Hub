import Papa from "papaparse";
import { readFileSync } from "fs";

// Replicates the exact header-alias logic in src/app/api/contacts/upload/route.ts
// to confirm the user's column headers map to the right fields (esp. websiteUrl).
const headerAliases: Record<string, string> = {
  name: "name",
  "owner name": "name",
  owner: "name",
  "contact name": "name",
  "full name": "name",
  "organization name": "name",
  "org name": "name",
  email: "email",
  "contact email": "email",
  "email address": "email",
  organization: "organization",
  company: "organization",
  "company name": "organization",
  "university / school": "organization",
  university: "organization",
  school: "organization",
  website: "websiteUrl",
  "company website": "websiteUrl",
  "website url": "websiteUrl",
  websiteurl: "websiteUrl",
  url: "websiteUrl",
  "linkedin / website": "websiteUrl",
  linkedin: "websiteUrl",
  "org type": "orgType",
  type: "orgType",
  orgtype: "orgType",
};

const text = readFileSync("samples/alta-contacts-template.csv", "utf8").replace(
  /^﻿/,
  "",
);

const { data } = Papa.parse<Record<string, string>>(text, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h: string) => {
    const n = h.trim().toLowerCase();
    return headerAliases[n] || n;
  },
});

console.log("Parsed rows (mapped to internal fields):");
for (const row of data) {
  console.log({
    name: row.name,
    email: row.email,
    organization: row.organization,
    websiteUrl: row.websiteUrl,
  });
  if (!row.websiteUrl) console.log("  !! websiteUrl MISSING — research would be skipped");
}
