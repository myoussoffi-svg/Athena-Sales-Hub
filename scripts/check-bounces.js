const { Client } = require("@microsoft/microsoft-graph-client");
const pg = require("pg");
const crypto = require("crypto");
require("dotenv").config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function decrypt(encryptedText) {
  const parts = encryptedText.split(":");
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parts[2], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function main() {
  const user = await pool.query(
    'SELECT "microsoftRefreshToken" FROM "User" LIMIT 1'
  );
  const refreshToken = decrypt(user.rows[0].microsoftRefreshToken);

  const resp = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "https://graph.microsoft.com/.default offline_access",
      }),
    }
  );
  const data = await resp.json();
  if (!data.access_token) {
    console.error("Token error:", JSON.stringify(data));
    process.exit(1);
  }

  const client = Client.init({
    authProvider: (done) => done(null, data.access_token),
  });

  // Search for Undeliverable messages (same as updated getRecentBounces)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  console.log("=== Searching for Undeliverable messages since", since.toISOString(), "===\n");

  const messages = await client
    .api("/me/messages")
    .filter(`receivedDateTime ge ${since.toISOString()} and startsWith(subject, 'Undeliverable')`)
    .top(50)
    .select("id,subject,body,from,receivedDateTime")
    .get();

  if (!messages.value || messages.value.length === 0) {
    console.log("No undeliverable messages found.");
    await pool.end();
    return;
  }

  console.log(`Found ${messages.value.length} undeliverable messages:\n`);

  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const systemPatterns = ["postmaster@", "mailer-daemon@", "ndr@", "notify@", "microsoftexchange", "@outlook.com"];

  // Get user email
  const me = await client.api("/me").select("mail,userPrincipalName").get();
  const userEmail = (me.mail || me.userPrincipalName).toLowerCase();

  const allBounced = new Set();

  for (const msg of messages.value) {
    const body = msg.body?.content || "";
    const foundEmails = body.match(emailRegex) || [];
    const bouncedForThis = [];

    for (const email of foundEmails) {
      const emailLower = email.toLowerCase();
      if (emailLower !== userEmail && !systemPatterns.some(s => emailLower.includes(s))) {
        bouncedForThis.push(emailLower);
        allBounced.add(emailLower);
      }
    }

    console.log(`Subject: ${msg.subject}`);
    console.log(`From: ${msg.from?.emailAddress?.address}`);
    console.log(`Bounced emails found: ${bouncedForThis.length > 0 ? bouncedForThis.join(", ") : "(none extracted)"}`);
    console.log("---");
  }

  console.log(`\n=== Summary: ${allBounced.size} unique bounced emails ===`);
  for (const e of allBounced) {
    console.log(`  ${e}`);
  }

  // Check which of these are contacts in the DB
  if (allBounced.size > 0) {
    const contacts = await pool.query(
      `SELECT id, name, email, status FROM "Contact" WHERE LOWER(email) = ANY($1)`,
      [Array.from(allBounced)]
    );
    console.log(`\n=== Matching contacts in DB ===`);
    for (const c of contacts.rows) {
      console.log(`  ${c.name} (${c.email}) - currently: ${c.status}`);
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});
