import { z } from "zod";

export type FieldErrors = Record<string, string>;
type FormDataFields=Record<string,FormDataEntryValue|FormDataEntryValue[]>;
function objectify(formData: FormData):FormDataFields {
  const formFields:FormDataFields = {};
  formData.forEach((value, name) => {
    const isArrayField = name.endsWith("[]");
    const fieldName = isArrayField ? name.slice(0, -2) : name;
    if (!(fieldName in formFields)) {
      formFields[fieldName] = isArrayField ? formData.getAll(name) : value;
    }
  });
  return formFields;
}

export const validateForm = async <T, S, E>(
  formData: FormData,
  zodSchema: z.Schema<T>,
  successFn: (data: T) => S,
  errorFn: (errors: FieldErrors) => E
): Promise<S | E> => {
  const result = zodSchema.safeParse(objectify(formData));
  if (!result.success) {
    const errors: FieldErrors = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    });
    return errorFn(errors);
  }

  return successFn(result.data);
};
