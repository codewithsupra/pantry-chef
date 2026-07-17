import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY env variable is not set");
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLinkEmail(email: string, magicLink: string) {
  return resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Your magic login link",
    html: `
      <h2>Log in to React Recipes</h2>
      <p>Click the link below to log in. This link expires in 10 minutes.</p>
      <a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:#c2410c;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
        Log In
      </a>
      <p style="color:#888;font-size:12px;margin-top:16px;">If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
