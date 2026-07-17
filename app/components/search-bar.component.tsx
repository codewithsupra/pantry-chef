import classNames from "classnames";
import { Form, useNavigation, useSearchParams, useSubmit } from "react-router";

type SearchBarProps = {
  placeholder?: string;
  
};
export function SearchBar({ placeholder = "Search recipes…", }: SearchBarProps) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSearching = navigation.formData?.has("q") ?? false;

  return (
    <Form method="get"  className="relative w-full mt-4">
      <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none text-stone-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </div>
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        autoComplete="off"
        defaultValue={searchParams.get("q")??""}
        onChange={(e) => submit(e.currentTarget.form, { method: "get" })}
        className={classNames(`w-full pl-10 pr-12 py-2.5 rounded-xl border border-stone-200 bg-stone-50 font-sans text-[14.5px] text-stone-700 outline-none focus:border-primary transition-colors ${isSearching ? "opacity-50" : ""}`)}
      />
      <button
        type="submit"
        className="absolute right-2  cursor-pointer inset-y-0 my-auto h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </button>
    </Form>
  );
}
