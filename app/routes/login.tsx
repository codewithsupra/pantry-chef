import { useState } from "react";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import { PrimaryButton } from "~/components/button.component";
import { PrimaryInput } from "~/components/forms.component";
import { ErrorMessage } from "~/components/form";
import { validateForm, type FieldErrors } from "~/lib/validation.server";
import type { Route } from "./+types/login";
import { commitSession, getSession } from "~/auth/sessions.server";
import { generateMagicLink } from "~/auth/magic-links.server";
import { sendMagicLinkEmail } from "~/lib/mailer.server";
import { v4 as uuid } from 'uuid';
import { requiredLoggedOutUserMiddleware } from "~/middleware/auth.middleware";
import { getCurrentUser } from "~/auth/auth.server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").regex(EMAIL_REGEX, "Please enter a valid email address"),
});

export const middleware=[requiredLoggedOutUserMiddleware];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const session = await getSession(request.headers.get("cookie"));

const result = await validateForm(formData, loginSchema, async ({ email }) => {
    const nonce = uuid();
    const magicLink = generateMagicLink(email, nonce);
    console.log("\n🔗 ========== MAGIC LINK ==========");
    console.log(magicLink);
    console.log("===================================\n");
    const response = await sendMagicLinkEmail(email, magicLink);
    if (response.error) {
      console.error("Resend error:", response.error);
    }
    session.set("nonce", nonce);
    return { magicLinkSent: true };
  }, (errors) => data({ errors }, { status: 400 }));

  if ("errors" in result) return result;

  return data(result, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

function getClientEmailError(email: string, touched: boolean): string | undefined {
  if (!touched) return undefined;
  if (!email) return "Email is required";
  if (!EMAIL_REGEX.test(email)) return `"${email}" is not a valid email address`;
  return undefined;
}

export default function Login() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const clientError = getClientEmailError(email, touched);
  const serverError = actionData && "errors" in actionData ? (actionData.errors as FieldErrors)?.["email"] : undefined;
  const emailError = clientError ?? serverError;
  const magicLinkSent = actionData && "magicLinkSent" in actionData && actionData.magicLinkSent;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-stone-50">
      <div className="w-full max-w-lg px-16 py-16 bg-white rounded-2xl shadow-sm border border-stone-100">
        <a href="/" className="text-sm text-stone-400 hover:text-primary transition-colors mb-10 flex items-center gap-1">
          ← Home
        </a>

        <h1 className="text-4xl font-serif text-stone-800 mb-2">Welcome back</h1>
        <p className="text-stone-400 text-sm mb-10">Enter your email to receive a magic link</p>

        

        {user ? null : magicLinkSent ? (
          <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-emerald-700 font-semibold text-lg">Check your email!</p>
            <p className="text-sm text-emerald-600 mt-1">We sent a magic link to <strong>{email}</strong></p>
          </div>
        ) : (
          <form
            method="post"
            onSubmit={(e) => {
              setTouched(true);
              if (!email || !EMAIL_REGEX.test(email)) e.preventDefault();
            }}
          >
            <div className="mb-4">
              <PrimaryInput
                type="text"
                name="email"
                placeholder="you@example.com"
                autoComplete="off"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setTouched(true); }}
                onBlur={() => setTouched(true)}
                className={emailError ? "border-red-400" : undefined}
              />
              <ErrorMessage>{emailError}</ErrorMessage>
            </div>
            <PrimaryButton name="_action" value="login" className="w-full mt-2">Send Magic Link</PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
}
