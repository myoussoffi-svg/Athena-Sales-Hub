import nodemailer from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface SendParams {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  /** For threading — the Message-ID of the email being replied to */
  inReplyTo?: string;
  /** For threading — space-separated list of ancestor Message-IDs */
  references?: string;
}

/**
 * Sends an email via a custom SMTP server.
 * Used for warmup domain sending and custom domain outreach.
 */
export async function sendViaSMTP(
  config: SmtpConfig,
  params: SendParams,
): Promise<{ messageId: string }> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // Connection timeout: 30s, greeting timeout: 15s
    connectionTimeout: 30_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });

  try {
    // Verify connection before sending
    await transport.verify();

    const fromField = params.fromName
      ? `"${params.fromName}" <${params.from}>`
      : params.from;

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromField,
      to: params.to,
      subject: params.subject,
      html: params.html,
    };

    // Threading headers for reply chains
    if (params.inReplyTo) {
      mailOptions.inReplyTo = params.inReplyTo;
    }
    if (params.references) {
      mailOptions.references = params.references;
    }

    const info = await transport.sendMail(mailOptions);

    return { messageId: info.messageId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SMTP error";
    throw new Error(`[smtp] Failed to send email to ${params.to}: ${message}`);
  } finally {
    transport.close();
  }
}
