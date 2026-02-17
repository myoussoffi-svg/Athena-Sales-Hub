import * as cheerio from "cheerio";
import { prisma } from "./db";
import { ContactStatus } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────────────────

interface ResearchResult {
  companyName?: string;
  description?: string;
  services?: string[];
  locations?: string[];
  teamInfo?: string;
  foundedYear?: string;
  industryDetails?: string;
  keyMessaging?: string;
  contactInfo?: string;
  rawText: string;
}

// ─── Website Research ───────────────────────────────────────────────

/**
 * Fetches and extracts structured data from a website URL.
 * Returns partial data on errors — never throws.
 */
export async function researchWebsite(url: string): Promise<ResearchResult> {
  const emptyResult: ResearchResult = { rawText: "" };

  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Fetch with timeout and realistic user-agent
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.warn(
        `[research-agent] HTTP ${response.status} fetching ${normalizedUrl}`,
      );
      return emptyResult;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script, style, and nav elements that pollute text extraction
    $("script, style, noscript, iframe, svg, nav, header").remove();

    // ── Extract structured fields ──────────────────────────────

    const result: ResearchResult = {
      rawText: "",
    };

    // Company name: from <title> tag or og:site_name
    const titleTag = $("title").first().text().trim();
    const ogSiteName = $('meta[property="og:site_name"]').attr("content");
    result.companyName = ogSiteName?.trim() || titleTag.split(/[|\-–—]/).shift()?.trim();

    // Description: meta description or og:description
    const metaDescription =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content");
    if (metaDescription) {
      result.description = metaDescription.trim();
    }

    // Main content text extraction
    const mainContent =
      $("main").text() || $("article").text() || $('[role="main"]').text();
    const bodyText = mainContent || $("body").text();
    const cleanedText = bodyText
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // ── Section-based extraction ───────────────────────────────

    // Services: look for "services", "what we do", "solutions" sections
    const servicePatterns = [
      "services",
      "what we do",
      "solutions",
      "offerings",
      "specialties",
      "practice areas",
    ];
    const services = extractSectionContent($, servicePatterns);
    if (services) {
      result.services = services
        .split(/[•\-\n,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3 && s.length < 100)
        .slice(0, 15);
    }

    // Locations: look for "locations", "offices", "where we are"
    const locationPatterns = [
      "locations",
      "offices",
      "where we are",
      "find us",
      "our offices",
    ];
    const locationText = extractSectionContent($, locationPatterns);
    if (locationText) {
      result.locations = locationText
        .split(/[•\-\n,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3 && s.length < 80)
        .slice(0, 10);
    }

    // Team/Staff: look for "team", "staff", "leadership", "about us"
    const teamPatterns = [
      "our team",
      "leadership",
      "staff",
      "about us",
      "who we are",
      "our people",
    ];
    const teamText = extractSectionContent($, teamPatterns);
    if (teamText) {
      result.teamInfo = teamText.slice(0, 500);
    }

    // Contact info: look for phone numbers, email patterns in footer or contact section
    const footerText = $("footer").text().replace(/\s+/g, " ").trim();
    const contactPatterns = ["contact", "get in touch", "reach us"];
    const contactSectionText = extractSectionContent($, contactPatterns);
    const contactSource = contactSectionText || footerText;

    if (contactSource) {
      // Extract phone numbers
      const phoneMatch = contactSource.match(
        /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      );
      // Extract email addresses
      const emailMatch = contactSource.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      );

      const contactParts: string[] = [];
      if (phoneMatch) contactParts.push(`Phone: ${phoneMatch[0]}`);
      if (emailMatch) contactParts.push(`Email: ${emailMatch[0]}`);
      if (contactParts.length > 0) {
        result.contactInfo = contactParts.join(" | ");
      }
    }

    // Founded year: look for "founded", "established", "since" patterns
    const yearMatch = cleanedText.match(
      /(?:founded|established|since|est\.?)\s*(?:in\s+)?(\d{4})/i,
    );
    if (yearMatch) {
      result.foundedYear = yearMatch[1];
    }

    // Industry details: from meta keywords or inferred from content
    const metaKeywords = $('meta[name="keywords"]').attr("content");
    if (metaKeywords) {
      result.industryDetails = metaKeywords.trim();
    }

    // Key messaging: from hero section, h1, or taglines
    const h1Text = $("h1").first().text().trim();
    const heroText = $('[class*="hero"], [class*="banner"], [class*="jumbotron"]')
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const keyMessaging = heroText || h1Text;
    if (keyMessaging && keyMessaging.length > 10) {
      result.keyMessaging = keyMessaging.slice(0, 300);
    }

    // Raw text: truncated to 3000 chars for AI context
    result.rawText = cleanedText.slice(0, 3000);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Handle specific error types gracefully
    if (message.includes("abort")) {
      console.warn(`[research-agent] Timeout fetching ${url}`);
    } else {
      console.warn(`[research-agent] Error researching ${url}: ${message}`);
    }

    return emptyResult;
  }
}

// ─── Enrich Contact ─────────────────────────────────────────────────

/**
 * Loads a contact, researches their website, and stores the results.
 * Updates contact status from NEW to RESEARCHED on success.
 */
export async function enrichContactWithResearch(
  contactId: string,
): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    console.warn(
      `[research-agent] Contact ${contactId} not found, skipping enrichment`,
    );
    return;
  }

  if (!contact.websiteUrl) {
    console.log(
      `[research-agent] Contact ${contactId} has no websiteUrl, skipping`,
    );
    return;
  }

  try {
    const researchData = await researchWebsite(contact.websiteUrl);

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        researchData: JSON.parse(JSON.stringify(researchData)),
        status:
          contact.status === ContactStatus.NEW
            ? ContactStatus.RESEARCHED
            : contact.status,
      },
    });

    console.log(
      `[research-agent] Enriched contact ${contactId} (${contact.name}) with research data`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        researchData: { error: message },
      },
    });

    console.error(
      `[research-agent] Failed to enrich contact ${contactId}: ${message}`,
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Searches for section headings matching the given patterns and extracts
 * the text content below them. Checks h1-h4 headings, section IDs, and
 * class names.
 */
function extractSectionContent(
  $: ReturnType<typeof cheerio.load>,
  patterns: string[],
): string | null {
  // Strategy 1: Find headings whose text matches the patterns
  for (const pattern of patterns) {
    const lowerPattern = pattern.toLowerCase();

    // Check h1-h4 tags
    const heading = $("h1, h2, h3, h4")
      .filter(function (this: cheerio.Element) {
        return $(this).text().toLowerCase().includes(lowerPattern);
      })
      .first();

    if (heading.length > 0) {
      // Get the parent section or the next siblings until the next heading
      const parent = heading.closest("section, div, article");
      if (parent.length > 0) {
        const text = parent.text().replace(/\s+/g, " ").trim();
        if (text.length > 20) {
          return text.slice(0, 1000);
        }
      }

      // Fallback: collect text from next siblings
      let text = "";
      let sibling = heading.next();
      let collected = 0;
      while (sibling.length > 0 && collected < 5) {
        const tagName = sibling.prop("tagName")?.toLowerCase();
        if (tagName && /^h[1-4]$/.test(tagName)) break; // Stop at next heading
        text += " " + sibling.text();
        sibling = sibling.next();
        collected++;
      }

      const cleaned = text.replace(/\s+/g, " ").trim();
      if (cleaned.length > 20) {
        return cleaned.slice(0, 1000);
      }
    }
  }

  // Strategy 2: Check section/div IDs and class names
  for (const pattern of patterns) {
    const slug = pattern.toLowerCase().replace(/\s+/g, "-");
    const slugAlt = pattern.toLowerCase().replace(/\s+/g, "_");

    const section = $(
      `[id*="${slug}"], [id*="${slugAlt}"], [class*="${slug}"], [class*="${slugAlt}"]`,
    ).first();

    if (section.length > 0) {
      const text = section.text().replace(/\s+/g, " ").trim();
      if (text.length > 20) {
        return text.slice(0, 1000);
      }
    }
  }

  return null;
}
