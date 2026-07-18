import { data, Form, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/settings";
import { userContext } from "~/middleware/auth.middleware";
import { updateUser } from "~/models/user.server";
import { validateForm, type FieldErrors } from "~/lib/validation.server";
import { Input } from "~/components/forms.component";
import { PrimaryButton } from "~/components/button.component";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export function meta(): ReturnType<Route.MetaFunction> {
  return [{ title: "Settings · PantryChef" }];
}

// Login is already enforced by the parent /app route's middleware.
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return { user };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const formData = await request.formData();

  return validateForm(
    formData,
    profileSchema,
    async ({ firstName, lastName }) => {
      await updateUser(user.id, { first_name: firstName, last_name: lastName });
      return data({ ok: true });
    },
    errors => data({ errors }, { status: 400 }),
  );
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const errors = (actionData as { errors?: FieldErrors })?.errors;
  const saved = (actionData as { ok?: boolean })?.ok;

  return (
    <div className="px-14 py-11 max-w-md">
      <h1 className="font-serif font-medium text-[32px] text-stone-800 mb-1">Your account</h1>
      <p className="text-stone-400 text-[15px] mb-9">Update your name or sign out below.</p>

      <Form method="post" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            id="firstName"
            name="firstName"
            defaultValue={user.first_name}
            error={!!errors?.firstName}
          />
          <Input
            label="Last name"
            id="lastName"
            name="lastName"
            defaultValue={user.last_name}
            error={!!errors?.lastName}
          />
        </div>
        {(errors?.firstName || errors?.lastName) && (
          <p className="text-sm text-red-400 -mt-2">{errors.firstName || errors.lastName}</p>
        )}

        <Input label="Email" id="email" name="email" defaultValue={user.email} disabled />
        <p className="text-xs text-stone-400 -mt-3">Email is tied to your magic-link sign-in and can&rsquo;t be changed here.</p>

        <div className="flex items-center gap-3 mt-2">
          <PrimaryButton type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </PrimaryButton>
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved.</span>}
        </div>
      </Form>

      <div className="mt-10 pt-6 border-t border-stone-200">
        <Form method="post" action="/logout">
          <button type="submit" className="text-sm text-stone-400 hover:text-red-400 transition-colors font-medium">
            Sign out
          </button>
        </Form>
      </div>
    </div>
  );
}
