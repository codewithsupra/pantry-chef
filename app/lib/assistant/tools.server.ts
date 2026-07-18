import { z } from "zod";
import { db } from "~/lib/db.server";

/**
 * Tools the kitchen assistant agent can invoke. Every execute() is scoped
 * to the authenticated user id passed in by the agent loop — the model
 * never supplies or sees another user's ids, and a hallucinated id can't
 * cross a user boundary because every query filters on userId.
 */

export type ToolResult = Record<string, unknown>;

type ToolDef<Schema extends z.ZodType> = {
  description: string;
  params: Schema;
  execute: (userId: string, args: z.infer<Schema>) => Promise<ToolResult>;
};

function defineTool<Schema extends z.ZodType>(def: ToolDef<Schema>): ToolDef<Schema> {
  return def;
}

export const tools = {
  get_pantry: defineTool({
    description: "Read the user's pantry: every shelf and the items on it. Takes no arguments.",
    params: z.object({}),
    execute: async userId => {
      const shelves = await db.pantryShelf.findMany({
        where: { userId },
        include: { items: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        shelves: shelves.map(s => ({ name: s.name, items: s.items.map(i => i.name) })),
      };
    },
  }),

  add_pantry_items: defineTool({
    description:
      'Add items to a pantry shelf. Creates the shelf if it does not exist. Args: {"shelfName": string, "items": string[]}',
    params: z.object({ shelfName: z.string().min(1), items: z.array(z.string().min(1)).min(1).max(30) }),
    execute: async (userId, { shelfName, items }) => {
      let shelf = await db.pantryShelf.findFirst({
        where: { userId, name: { equals: shelfName, mode: "insensitive" } },
      });
      shelf ??= await db.pantryShelf.create({ data: { userId, name: shelfName } });

      // Skip items already on the shelf (case-insensitive) so the agent
      // re-running a step can't fill a shelf with duplicates.
      const existing = await db.pantryItem.findMany({ where: { userId, shelfId: shelf.id } });
      const existingNames = new Set(existing.map(i => i.name.toLowerCase()));
      const toCreate = items.filter(i => !existingNames.has(i.toLowerCase()));

      await db.pantryItem.createMany({
        data: toCreate.map(name => ({ userId, shelfId: shelf!.id, name })),
      });
      return { shelf: shelf.name, added: toCreate, skippedExisting: items.filter(i => existingNames.has(i.toLowerCase())) };
    },
  }),

  remove_pantry_item: defineTool({
    description: 'Remove an item from the pantry by name. Args: {"itemName": string}',
    params: z.object({ itemName: z.string().min(1) }),
    execute: async (userId, { itemName }) => {
      const item = await db.pantryItem.findFirst({
        where: { userId, name: { equals: itemName, mode: "insensitive" } },
      });
      if (!item) return { removed: false, reason: `No pantry item named "${itemName}"` };
      await db.pantryItem.delete({ where: { id: item.id } });
      return { removed: true, item: item.name };
    },
  }),

  list_recipes: defineTool({
    description: "List the user's saved recipes (names, total time, ingredient names). Takes no arguments.",
    params: z.object({}),
    execute: async userId => {
      const recipes = await db.recipe.findMany({
        where: { userId },
        include: { ingredients: { select: { name: true, amount: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        recipes: recipes.map(r => ({
          name: r.name,
          totalTime: r.totalTime,
          ingredients: r.ingredients.map(i => `${i.amount} ${i.name}`.trim()),
        })),
      };
    },
  }),

  create_recipe: defineTool({
    description:
      'Save a new recipe for the user. Args: {"name": string, "totalTime": string like "25 min", "ingredients": [{"amount": string, "name": string}], "instructions": string}',
    params: z.object({
      name: z.string().min(1),
      totalTime: z.string().min(1),
      ingredients: z.array(z.object({ amount: z.string(), name: z.string().min(1) })).min(1).max(40),
      instructions: z.string().min(1),
    }),
    execute: async (userId, { name, totalTime, ingredients, instructions }) => {
      const existing = await db.recipe.findFirst({
        where: { userId, name: { equals: name, mode: "insensitive" } },
      });
      if (existing) return { created: false, reason: `A recipe named "${name}" already exists` };

      const recipe = await db.recipe.create({
        data: {
          userId,
          name,
          totalTime,
          instructions,
          imgUrl: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400",
          ingredients: { create: ingredients },
        },
      });
      return { created: true, recipeId: recipe.id, name: recipe.name };
    },
  }),
} as const;

export type ToolName = keyof typeof tools;

export function toolCatalogForPrompt(): string {
  return Object.entries(tools)
    .map(([name, t]) => `- ${name}: ${t.description}`)
    .join("\n");
}

export async function runTool(name: string, userId: string, rawArgs: unknown): Promise<ToolResult> {
  const tool = tools[name as ToolName];
  if (!tool) return { error: `Unknown tool "${name}". Valid tools: ${Object.keys(tools).join(", ")}` };
  const parsed = tool.params.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { error: `Invalid arguments for ${name}: ${parsed.error.issues.map(i => i.message).join("; ")}` };
  }
  try {
    return await tool.execute(userId, parsed.data as never);
  } catch (error) {
    return { error: `Tool ${name} failed: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}
