
import { getMagicLinkPayload } from "~/auth/magic-links.server";
import type { Route } from "./+types/validate-magic-link";
import { errorJSON } from "~/models/utils";
import { commitSession, getSession } from "~/auth/sessions.server";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { createUser, getUser } from "~/models/user.server";
import classNames from "classnames";
import { PrimaryInput } from "~/components/forms.component";
import { ErrorMessage } from "~/components/form";
import { PrimaryButton } from "~/components/button.component";
import { z } from "zod";
import { validateForm } from "~/lib/validation.server";

const MAX_AGE=1000*60*10;

export async function loader({ request }: Route.LoaderArgs) {
  const magicLinkPayload = getMagicLinkPayload(request);

  // 1. Validate expiration time
  const createdAt = new Date(magicLinkPayload.createdAt);
  const expiresAt = createdAt.getTime() + MAX_AGE;
  if (Date.now() > expiresAt) {
    throw errorJSON("Link has expired", 400);
  }

  // 2. Validate nonce
  const session = await getSession(request.headers.get("cookie"));
  const nonce = session.get("nonce");
  if (nonce !== magicLinkPayload.nonce) {
    throw errorJSON("Invalid or already used magic link", 400);
  }
  session.unset("nonce");

  // 3. Existing user → log in and redirect
  const user = await getUser(magicLinkPayload.email);
  if (user) {
    session.set("userId", user.id);
    session.set("name", `${user.first_name} ${user.last_name}`);
    return redirect("/app", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  // 4. New user → show signup form, commit session to clear the nonce
  return data({ email: magicLinkPayload.email }, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
const signUpSchema=z.object({
    firstName:z.string().min(1,'First Name cannot be blank'),
    lastName:z.string().min(1,'Last Name cannot be blank'),
})
export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("cookie"));
  const formData = await request.formData();
  const { email } = getMagicLinkPayload(request);

  const result = await validateForm(formData, signUpSchema, async ({ firstName, lastName }) => {
    const user = await createUser(email, firstName, lastName);
    session.set("userId", user.id);
    session.set("name", `${user.first_name} ${user.last_name}`);
    return { userId: user.id };
  }, (errors) => ({ errors, fields: { firstName: String(formData.get("firstName") ?? ""), lastName: String(formData.get("lastName") ?? "") } }));

  if ("errors" in result) return result;

  return redirect("/app", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function ValidateMagicLink() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const errors = actionData && "errors" in actionData ? actionData.errors : null;
  const fields = actionData && "fields" in actionData ? actionData.fields : null;
  const email = loaderData && "email" in loaderData ? loaderData.email : null;
  return (
    <div className="text-center">
      <div className="mt-24">
        <p className="flex  border-b-2 text-2xl gap-2 justify-center">
          <h1>Almost done!!</h1>
          <span>{email}</span>
        </p>
        <h2>Type in your name to complete signup process!!!</h2>
        <form method="post" className={classNames(
          "flex flex-col px-8 mx-16 md:mx-auto",
          "border-2 border-gray-200 rounded-md p-8 mt-8 md:w-80"
        )}>
          <fieldset className="mb-8 flex flex-col">
            <div className="text-left mb-4">
              <label htmlFor="firstName">First Name</label>
              <PrimaryInput
                id="firstName"
                autoComplete="off"
                name="firstName"
                defaultValue={fields?.firstName}
                className={errors?.firstName ? "border-red-400" : undefined}
              />
              <ErrorMessage>{errors?.firstName}</ErrorMessage>
            </div>
            <div className="text-left">
              <label htmlFor="lastName">Last Name</label>
              <PrimaryInput
                id="lastName"
                autoComplete="off"
                name="lastName"
                defaultValue={fields?.lastName}
                className={errors?.lastName ? "border-red-400" : undefined}
              />
              <ErrorMessage>{errors?.lastName}</ErrorMessage>
            </div>
          </fieldset>
          <PrimaryButton className="w-36 mx-auto cursor-pointer">Sign Up!</PrimaryButton>
        </form>
      </div>
    </div>
  );
}