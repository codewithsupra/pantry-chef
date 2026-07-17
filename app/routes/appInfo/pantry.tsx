import type { PantryShelf, PantryItem } from "@prisma/client";
import { useEffect, useRef } from "react";
import { z } from "zod";
import {
  Form,
  data,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useSearchParams,
  useSubmit,
  useFetcher,
} from "react-router";
import { createShelf, deleteShelf, getALLShelves, getShelf, saveShelfName } from "~/models/pantry-shelf.server";

import { createShelfItem, deleteShelfItem, getShelfItem } from "~/models/pantry-item.server";
import { validateForm } from "~/lib/validation.server";
import { userContext } from "~/middleware/auth.middleware";
import type { Route } from "./+types/pantry";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const user = context.get(userContext);
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  console.log("PANTRY LOADER HIT, q =", q);
  const shelves = await getALLShelves(user.id, q);
  return { shelves };
};

const deleteShelfSchema = z.object({
  shelfId: z.string().min(1, "Shelf ID is required"),
});

const saveShelfNameSchema = z.object({
  shelfId: z.string().min(1, "Shelf ID is required"),
  shelfName: z.string().min(1, "Shelf name cannot be empty!"),
});

const createShelfItemSchema = z.object({
  shelfId: z.string().min(1, "Shelf ID is required"),
  itemName: z.string().min(1, "Item name cannot be empty!"),
});

const deleteShelfItemSchema = z.object({
  itemId: z.string().min(1, "Please select an item to delete"),
});

export const action = async ({ request, context }: Route.ActionArgs) => {
  const user = context.get(userContext);
  const formData = await request.formData();
  switch (formData.get("_action")) {
    case "createShelf": {
      return createShelf(user.id);
    }
    case "deleteShelf": {
      return validateForm(
        formData,
        deleteShelfSchema,
        async (parsedData) => {
          const shelf = await getShelf(parsedData.shelfId);
          if (shelf  && shelf.userId !== user.id) {
            throw data({ message: "This shelf is not yours, so you cannot delete it" }, { status: 401 });
          }
          return deleteShelf(parsedData.shelfId);
        },
        (errors) => data({ errors }, { status: 400 }),
      );
    }
    case "saveShelfName": {
      return validateForm(
        formData,
        saveShelfNameSchema,
        async (parsedData) => {
          const shelf = await getShelf(parsedData.shelfId);
          if (shelf !== null && shelf.userId !== user.id) {
            throw data({ message: "This shelf is not yours, so you cannot change its name" }, { status: 401 });
          }
          return saveShelfName(parsedData.shelfId, parsedData.shelfName);
        },
        (errors) => data({ errors }, { status: 400 }),
      );
    }
    case "createShelfItem": {
      return validateForm(
        formData,
        createShelfItemSchema,
        async (parsedData) => {
          const shelf = await getShelf(parsedData.shelfId);
          if (shelf && shelf.userId !== user.id) {
            throw data({ message: "This shelf is not yours, so you cannot add items to it" }, { status: 401 });
          }
          return createShelfItem(user.id, parsedData.shelfId, parsedData.itemName);
        },
        (errors) => data({ errors }, { status: 400 }),
      );
    }
    case "deleteShelfItem": {
      return validateForm(
        formData,
        deleteShelfItemSchema,
        async (parsedData) => {
          const item = await getShelfItem(parsedData.itemId);
          if (item && item.userId === user.id) {
            throw data({ message: "This item is not yours, so you cannot delete it" }, { status: 401 });
          }
          return deleteShelfItem(parsedData.itemId);
        },
        (errors) => data({ errors }, { status: 400 }),
      );
    }
    default:
      return null;
  }
};

const DOT_COLORS = [
  "bg-orange-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-violet-400",
] as const;

export default function Pantry() {
  const { shelves } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const createShelfFetcher = useFetcher();

  const isCreatingShelf = createShelfFetcher.formData?.get("_action") === "createShelf";
  const query = searchParams.get("q") ?? "";
  const shelfCount = shelves.length;

  return (
    <div className="px-14 py-11">
      {/* Header */}
      <div className="flex items-baseline gap-3.5 mb-1.5">
        <h1 className="font-serif font-medium text-[40px] tracking-tight text-stone-800 m-0">
          The Pantry
        </h1>
        <span className="text-sm text-stone-400 italic font-serif">
          {shelfCount === 1 ? "1 shelf" : `${shelfCount} shelves`}
        </span>
      </div>
      <p className="text-[15px] text-stone-400 mb-7">
        A tidy shelf for everything in your kitchen.
      </p>

      {/* Search + Create */}
      <div className="flex flex-wrap gap-3.5 items-center mb-8">
        <Form method="get" className="relative w-80 max-w-full">
          <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none text-stone-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            type="search"
            name="q"
            placeholder="Search shelves…"
            autoComplete="off"
            defaultValue={query}
            onChange={(e) => submit(e.currentTarget.form, { method: "get" })}
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 font-sans text-[14.5px] text-stone-700 outline-none focus:border-primary transition-colors"
          />
        </Form>

        <createShelfFetcher.Form method="POST">
          <button
            name="_action"
            value="createShelf"
            disabled={isCreatingShelf}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-[14.5px] shadow-md shadow-primary/25 transition-all hover:bg-primary-light hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {isCreatingShelf ? "Creating…" : "New Shelf"}
          </button>
        </createShelfFetcher.Form>
      </div>

      {/* Empty state */}
      {shelves.length === 0 && (
        <div className="py-12 px-8 text-center text-stone-400 italic font-serif text-lg border border-dashed border-stone-200 rounded-2xl">
          {query
            ? `No shelves match "${query}" — the pantry is quiet today.`
            : "No shelves yet — create one to get started."}
        </div>
      )}

      {/* Shelf grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {shelves.map((shelf: PantryShelf & { items: PantryItem[] }, idx) => (
          <Shelf key={shelf.id} shelf={shelf} dotColorClass={DOT_COLORS[idx % DOT_COLORS.length]} />
        ))}
      </div>
    </div>
  );
}

type ShelfItemProps = {
  item: PantryItem;
};

function ShelfItem({ item }: ShelfItemProps) {
  const deleteItemFetcher = useFetcher<any>();
  const isDeletingItem = !!deleteItemFetcher.formData;

  return isDeletingItem ? null : (
    <li className="flex items-center justify-between py-1.5 px-0.5 rounded-lg group">
      <span className="text-[14.5px] text-stone-600 flex items-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        {item.name}
      </span>
      <deleteItemFetcher.Form method="post">
        <input type="hidden" name="itemId" value={item.id} />
        <button
          name="_action"
          value="deleteShelfItem"
          title="Remove item"
          className="p-1 rounded-md text-stone-300 hover:text-red-400 transition-colors flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </deleteItemFetcher.Form>
    </li>
  );
}

type ShelfItemListProps = {
  items: PantryItem[];
  shelfId: string;
};

function ShelfItemList({ items, shelfId }: ShelfItemListProps) {
  const addItemFetcher = useFetcher<any>();

  return (
    <>
      <ul className="list-none m-0 p-0 flex flex-col gap-0.5 min-h-6">
        {items.length === 0 && (
          <li className="py-1.5 text-[13.5px] text-stone-400 italic">Nothing here yet.</li>
        )}
        {items.map((item) => (
          <ShelfItem key={item.id} item={item} />
        ))}
      </ul>

      <addItemFetcher.Form
        method="post"
        className="flex items-center gap-2 mt-3 pt-2.5 border-t border-dashed border-stone-200"
      >
        <input type="hidden" name="shelfId" value={shelfId} />
        <input
          key={items.length}
          type="text"
          name="itemName"
          placeholder="Add an item…"
          autoComplete="off"
          className="flex-1 border-none outline-none bg-transparent text-[13.5px] text-stone-700 border-b border-b-transparent focus:border-b-primary pb-0.5 transition-colors placeholder:text-stone-400"
        />
        {addItemFetcher.data?.errors?.itemName && (
          <p className="text-xs text-red-400">{addItemFetcher.data.errors.itemName}</p>
        )}
        <button
          name="_action"
          value="createShelfItem"
          className="p-1 text-primary hover:text-primary-light transition-colors flex"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </addItemFetcher.Form>
    </>
  );
}

type ShelfProps = {
  shelf: PantryShelf & { items: PantryItem[] };
  dotColorClass: string;
};

function Shelf({ shelf, dotColorClass }: ShelfProps) {
  const deleteShelfFetcher = useFetcher<any>();
  const saveShelfNameFetcher = useFetcher<any>();
  const shelfNameInputRef = useRef<HTMLInputElement>(null);

  const shelfNameError = saveShelfNameFetcher.data?.errors?.shelfName;

  useEffect(() => {
    if (!saveShelfNameFetcher.data) return;
    if (shelfNameError) {
      if (shelfNameInputRef.current) shelfNameInputRef.current.value = shelf.name;
    }
  }, [saveShelfNameFetcher.data]);

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-[18px] p-5 pb-4.5 flex flex-col shadow-sm">
      {/* Shelf name row */}
      <saveShelfNameFetcher.Form method="post">
        <input type="hidden" name="_action" value="saveShelfName" />
        <input type="hidden" name="shelfId" value={shelf.id} />
        <div className="group flex items-start gap-2.5 mb-1">
          <span className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 ${dotColorClass}`} />
          <div className="flex-1 flex items-start gap-1.5">
            <div className="flex-1">
              <input
                ref={shelfNameInputRef}
                type="text"
                name="shelfName"
                defaultValue={shelf.name}
                placeholder="Name this shelf…"
                onBlur={(e) => saveShelfNameFetcher.submit(e.currentTarget.form)}
                className={`w-full outline-none transition-colors placeholder:text-stone-400 bg-transparent border-b-2 pb-0.5 font-serif font-medium text-[21px] text-stone-800 rounded-none ${shelfNameError ? "border-b-red-400 focus:border-b-red-400" : "border-b-transparent hover:border-b-stone-300 focus:border-b-primary"}`}
              />
              {shelfNameError && (
                <p className="mt-1 text-xs text-red-400">{shelfNameError}</p>
              )}
            </div>
            {/*
              Visible save affordance: the onBlur handler above needs JS to
              fire, so without it (or for a keyboard user who tabs away
              instead of blurring via click) there was previously no way to
              save a rename except pressing Enter. This is a real <button
              type="submit"> in the same <form>, so it works identically
              with JS on or off. Kept low-visual-weight (only shown while
              the row has focus) so it doesn't clutter the default state.
            */}
            <button
              type="submit"
              title="Save name"
              className="mt-2 p-1 rounded-md text-stone-300 opacity-0 group-focus-within:opacity-100 hover:text-primary hover:opacity-100 transition-opacity shrink-0"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          </div>
          <deleteShelfFetcher.Form method="post" className="mt-0.5">
            <input type="hidden" name="shelfId" value={shelf.id} />
            <button
              name="_action"
              value="deleteShelf"
              title="Delete shelf"
              onClick={(e) => {
                if (!confirm("Are you sure you want to delete this shelf?")) e.preventDefault();
              }}
              className="p-1.5 rounded-lg text-stone-400 opacity-60 hover:opacity-100 hover:text-red-400 transition-all flex"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </deleteShelfFetcher.Form>
        </div>
      </saveShelfNameFetcher.Form>

      {/* Divider */}
      <div className="h-px bg-stone-100 my-2" />

      {/* Items */}
      <ShelfItemList items={shelf.items} shelfId={shelf.id} />
    </div>
  );
}
