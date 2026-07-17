import { data, Form, redirect, useActionData, useFetcher, useLoaderData, useNavigation } from "react-router";
import { requireLoggedInUserMiddleware, userContext } from "~/middleware/auth.middleware";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import type { Route } from "./+types/$recipeId";
import {db} from '~/lib/db.server'
import { Input } from "~/components/forms.component";
import { ErrorMessage } from "~/components/form";
import { AiEditIcon, ClipboardCheckIcon, ClipboardIcon, EditIcon, SaveIcon, TimeIcon, TrashIcon } from "~/components/icons";
import React from "react";
import classNames from "classnames";
import { DeleteButton, SaveButton } from "~/components/button.component";
import { validateForm } from "~/lib/validation.server";
import z from "zod";
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

async function callAI(prompt: string): Promise<string> {
    const res = await openrouter.chat.send({
        chatRequest: {
            model: "poolside/laguna-m.1:free",
            messages: [{ role: "user", content: prompt }],
        }
    });
    return (res as any).choices[0]?.message?.content ?? "";
}


export const middleware = [requireLoggedInUserMiddleware];

export function headers({ loaderHeaders }: Route.HeadersArgs) {
    return loaderHeaders;
}
export async function loader({params, context}:Route.LoaderArgs){
    const user = context.get(userContext);
    const {recipeId}=params;
    const recipe=await db.recipe.findUnique({
        where :{
            id:recipeId
        },
        include:{
            ingredients:{
                select:{
                    id:true,
                    amount:true,
                    name:true
                },
                orderBy:{ createdAt:"asc" }
            }
        }
    })
    if (!recipe) throw new Response("Recipe not found", { status: 404 });
    if (recipe.userId !== user.id) throw new Response("Forbidden", { status: 403 });
    const meta = (recipe.metadata as Record<string, unknown>) ?? {};
    if (recipe.ingredients.length > 0 && (!meta.calories || !meta.healthAdvice)) {
        try {
            const ingredientList = recipe.ingredients.map(i => `${i.amount} ${i.name}`).join(", ");
            const [calories, healthAdvice] = await Promise.all([
                callAI(`Estimate the total calories for this recipe. Recipe: ${recipe.name}. Ingredients: ${ingredientList}. Return only a short value like "450 kcal", nothing else.`),
                callAI(`Give one short, practical healthy eating tip or substitution for this recipe: ${recipe.name}. Ingredients: ${ingredientList}. Return only 1-2 sentences, nothing else.`),
            ]);
            const updatedRecipe = await db.recipe.update({ where: { id: recipeId }, data: { metadata: { ...meta, calories, healthAdvice } } });
            recipe.metadata = updatedRecipe.metadata;
        } catch {
            // AI rate limited or unavailable — skip silently, will retry on next visit
        }
    }
    return data({ recipe }, {
        headers: {
            "Cache-Control": "max-age=5",
        }
    });
}

const createIngredientSchema = z.object({
    newIngredientName: z.string().min(1, "Name is required"),
    newIngredientAmount: z.string().optional(),
});

const deleteIngredientSchema = z.object({
    ingredientId: z.string().min(1, "Ingredient ID is required"),
});

const saveRecipeSchema=z.object({
    name:z.string().min(1,"Name cannot be blank"),
    totalTime:z.string().min(1,"Total time cannot be blank"),
    instructions:z.string().min(1,"Instructions cannot be blank"),
    ingredientsId: z.array(z.string()).optional(),
    ingredientAmount: z.array(z.string()).optional(),
    ingredientName: z.array(z.string()).optional(),
});

export async function action({request, params, context}:Route.ActionArgs){
    const user = context.get(userContext);
    const existing = await db.recipe.findUnique({ where: { id: params.recipeId }, select: { userId: true } });
    if (!existing) throw new Response("Recipe not found", { status: 404 });
    if (existing.userId !== user.id) throw new Response("Forbidden", { status: 403 });
    const formData=await request.formData();
    const actionType=formData.get("_action");
    console.log(formData.getAll('ingredientName'))
    switch(actionType){
        case "saveName": {
            return validateForm(
                formData,
                z.object({ name: z.string().min(1, "Name cannot be blank") }),
                async ({ name }) => {
                    await db.recipe.update({ where: { id: params.recipeId }, data: { name } });
                    return { success: true };
                },
                (errors) => data({ errors }, { status: 400 })
            );
        }
        case "saveRecipe":{
            return validateForm(
                formData,
                saveRecipeSchema,
                async ({ingredientName,ingredientAmount,ingredientsId,name,totalTime,instructions})=>{
                    const {recipeId}=params;
                    await Promise.all(
                        (ingredientsId ?? []).map((id: string, idx: number) =>
                            db.ingredient.update({
                                where: { id },
                                data: {
                                    name: ingredientName?.[idx] ?? "",
                                    amount: ingredientAmount?.[idx] ?? "",
                                },
                            })
                        )
                    );
                    const newRecipe = await db.recipe.update({
                        where: { id: recipeId },
                        data: { name, totalTime, instructions }
                    });
                    return { success: true, newRecipe };
                },
                (errors)=>data({errors},{status:400})
            )
        }
        case "aiEditInstructions": {
            const instructions = formData.get("instructions") as string;
            const prompt = formData.get("aiPrompt") as string;
            if (!instructions || !prompt) return data({ errors: { _form: "Missing instructions or prompt." } }, { status: 400 });
            const improved = await callAI(`Here are cooking instructions:\n\n${instructions}\n\nUser request: "${prompt}"\n\nRewrite the instructions based on the user's request. Return only the updated instructions, nothing else.`);
            return { aiResult: improved };
        }
        case "generateSummary": {
            const { recipeId } = params;
            const recipe = await db.recipe.findUnique({ where: { id: recipeId } });
            if (!recipe) return data({ errors: { _form: "Recipe not found." } }, { status: 404 });
            const meta = (recipe.metadata as Record<string, unknown>) ?? {};
            const summary = await callAI(`Generate a short, appetizing 2-sentence summary for this recipe:
Name: ${recipe.name}
Total Time: ${recipe.totalTime}
Instructions: ${recipe.instructions}
Servings: ${meta.servings ?? "unknown"}
Difficulty: ${meta.difficulty ?? "unknown"}
Tags: ${(meta.tags as string[] ?? []).join(", ") || "none"}

Return only the summary, nothing else.`);
            await db.recipe.update({ where: { id: recipeId }, data: { metadata: { ...meta, summary } } });
            return { summary };
        }
        case "createIngredient": {
            const { recipeId } = params;
            return validateForm(
                formData,
                createIngredientSchema,
                async ({ newIngredientName, newIngredientAmount }) => {
                    await db.ingredient.create({
                        data: { name: newIngredientName, amount: newIngredientAmount || "-", recipeId: recipeId! }
                    });
                    return { success: true };
                },
                (errors) => data({ errors }, { status: 400 })
            );
        }
        case "saveTotalTime": {
            return validateForm(
                formData,
                z.object({ totalTime: z.string().min(1, "Total time cannot be blank") }),
                async ({ totalTime }) => {
                    await db.recipe.update({ where: { id: params.recipeId }, data: { totalTime } });
                    return { success: true };
                },
                (errors) => data({ errors }, { status: 400 })
            );
        }
        case "saveInstructions": {
            return validateForm(
                formData,
                z.object({ instructions: z.string().min(1, "Instructions cannot be blank") }),
                async ({ instructions }) => {
                    await db.recipe.update({ where: { id: params.recipeId }, data: { instructions } });
                    return { success: true };
                },
                (errors) => data({ errors }, { status: 400 })
            );
        }
        case "deleteRecipe": {
            const { recipeId } = params;
            await db.recipe.delete({ where: { id: recipeId } });
            return redirect("/app/recipes");
        }
        case "deleteIngredient": {
            return validateForm(
                formData,
                deleteIngredientSchema,
                async ({ ingredientId }) => {
                    await db.ingredient.delete({ where: { id: ingredientId } });
                    return { success: true };
                },
                (errors) => data({ errors }, { status: 400 })
            );
        }
        default:{
            return null;
        }

    }


    }



export default function RecipeDetails(){
    const{recipe}=useLoaderData<typeof loader>();
    const actionData=useActionData<typeof action>();

    const saveNameFetcher=useFetcher();
    const saveTotalTimeFetcher=useFetcher();
    const saveInstructionsFetcher=useFetcher();
    const [editRecipe,setEditRecipe]=useState(false);
    const [showAll, setShowAll] = useState(false);
    const [editingInstructions, setEditingInstructions] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [copied, setCopied] = useState(false);
    const [persistedAiResult, setPersistedAiResult] = useState<string | null>(null);
    const navigation = useNavigation();
    const isAiLoading = navigation.state === "submitting" && navigation.formData?.get("_action") === "aiEditInstructions";
    const isSummaryLoading = navigation.state === "submitting" && navigation.formData?.get("_action") === "generateSummary";
    const meta = (recipe.metadata as Record<string, unknown>) ?? {};
    const summary = actionData && "summary" in actionData ? (actionData as any).summary as string : meta.summary as string | undefined;
    const aiResult = persistedAiResult;
    const errors = actionData && "errors" in actionData ? (actionData as any).errors as Record<string, string> : {};



    function saveName(name:string){
        return saveNameFetcher.submit({
            _action:"saveName",
            name,
        },{method:"post"}
    )
    }

    function saveTotalTime(totalTime: string) {
        return saveTotalTimeFetcher.submit({ _action: "saveTotalTime", totalTime }, { method: "post" });
    }

    function saveInstructions(instructions: string) {
        return saveInstructionsFetcher.submit({ _action: "saveInstructions", instructions }, { method: "post" });
    }

    useEffect(()=>{
        if(!actionData) return;
        if("success" in actionData && (actionData as any).newRecipe){
            toast.success(`"${recipe.name}" has been updated!`);
        }
        if("aiResult" in actionData && (actionData as any).aiResult){
            setPersistedAiResult((actionData as any).aiResult);
        }
    },[actionData]);
    const visibleIngredients = showAll ? recipe.ingredients : recipe.ingredients.slice(0, 5);
    return(
        <Form  method="post" className="p-4">
            <div className="mb-2 flex items-center justify-between">
                <div className="grow">
                <Input key={recipe.id}
                type="text"
                 placeholder="Recipe Name"
                 autoCapitalize="off" autoComplete="off"
                 className="text-2xl font-extrabold"
                 name="name"
                 variant="ghost"
                 defaultValue={recipe.name}
                 error={!!((saveNameFetcher.data as any)?.errors?.name ?? errors?.name)}
                 onChange={(event) => saveName(event.target.value)}/>
                
                <ErrorMessage>{(saveNameFetcher.data as any)?.errors?.name ?? errors?.name}</ErrorMessage>
                </div>
                <button type="button" onClick={()=>setEditRecipe((v)=>!v)} className={classNames(
                    "flex gap-1 items-center cursor-pointer text-xs font-medium px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ml-3",
                    editRecipe
                        ? "border-red-300 text-red-500 bg-red-50 hover:bg-red-100"
                        : "border-stone-300 text-stone-500 hover:border-primary hover:text-primary"
                )}>
                    {!editRecipe &&<EditIcon />}
                    <span>{editRecipe ? "Cancel" : "Edit"}</span>
                </button>
            </div>
            <div className="flex items-center ">
                <TimeIcon />
                <div className="ml-2 grow">
                <Input
                key={recipe.id}
                type="text"
                placeholder="Time"
                autoComplete="off"
                name="totalTime"
                variant="ghost"
                defaultValue={recipe.totalTime}
                error={!!((saveTotalTimeFetcher.data as any)?.errors?.totalTime ?? errors?.totalTime)}
                onChange={(e) => saveTotalTime(e.target.value)}
                />
                <ErrorMessage>{(saveTotalTimeFetcher.data as any)?.errors?.totalTime ?? errors?.totalTime}</ErrorMessage>
                </div>
            </div>
            <div className="grid grid-cols-[30%_auto_min-content] my-4 gap-2">
                <h2 className="font-bold text-sm pb-1">Amount</h2>
                <h2 className="font-bold text-sm pb-1">Name</h2>
                <div></div>
                {visibleIngredients.map((i)=>(
                    <IngredientRow key={i.id} i={i} errors={errors} />
                ))}
                {recipe.ingredients.length > 5 && (
                    <button
                        type="button"
                        onClick={() => setShowAll(v => !v)}
                        className="col-span-3 text-sm text-primary hover:underline text-left mt-1"
                    >
                        {showAll ? "Show less" : `+ ${recipe.ingredients.length - 5} more ingredients`}
                    </button>
                )}
            </div>
            <div className="grid grid-cols-[30%_auto_min-content] gap-2 group rounded-lg px-1 py-2 hover:bg-primary/5 transition-colors duration-200 mt-1">
                <Input key={`amt-${recipe.ingredients.length}`} type="text" autoComplete="off" name="newIngredientAmount" variant="ghost" placeholder="Amount" />
                <div>
                    <Input key={`name-${recipe.ingredients.length}`} type="text" autoComplete="off" name="newIngredientName" variant="ghost" placeholder="New ingredient…" error={!!errors?.newIngredientName} />
                    <ErrorMessage>{errors?.newIngredientName}</ErrorMessage>
                </div>
                <button type="submit" name="_action" value="createIngredient" className="flex items-center justify-center w-7 h-7 rounded-full text-stone-300 group-hover:text-white group-hover:bg-primary transition-all duration-200 font-bold text-lg">
                    +
                </button>
            </div>
            {(meta.calories || meta.healthAdvice) && (
                <div className="my-4 flex gap-3">
                    {!!meta.calories && (
                        <div className="flex-1 p-3 rounded-xl bg-orange-50 border border-orange-100">
                            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Calories</p>
                            <p className="text-lg font-bold text-orange-500">{String(meta.calories)}</p>
                        </div>
                    )}
                    {!!meta.healthAdvice && (
                        <div className="flex-2 p-3 rounded-xl bg-green-50 border border-green-100">
                            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Health Tip</p>
                            <p className="text-sm text-stone-600 leading-relaxed">{String(meta.healthAdvice)}</p>
                        </div>
                    )}
                </div>
            )}
            {summary && (
                <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">AI Summary</p>
                    <p className="text-sm text-stone-600 leading-relaxed">{summary}</p>
                </div>
            )}
            <div className="flex items-center justify-between mb-2">
                <label htmlFor="instructions" className="block font-bold text-lg underline underline-offset-2 w-fit">
                    {'Instructions'.toLocaleUpperCase()}
                </label>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setShowAiPrompt(v => !v)} className={classNames(
                        "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
                        showAiPrompt
                            ? "border-primary text-primary bg-primary/10"
                            : "border-stone-300 text-stone-500 hover:border-primary hover:text-primary"
                    )}>
                        <AiEditIcon /> AI Edit
                    </button>
                    <button type="button" onClick={() => setEditingInstructions(v => !v)} className={classNames(
                        "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
                        editingInstructions
                            ? "border-red-300 text-red-500 bg-red-50 hover:bg-red-100"
                            : "border-stone-300 text-stone-500 hover:border-primary hover:text-primary"
                    )}>
                        {editingInstructions ? "Done" : "Edit"}
                    </button>
                </div>
            </div>
            {showAiPrompt && (
                <div className="mb-3 p-3 border border-primary/30 rounded-xl bg-primary/5 flex flex-col gap-2">
                    <p className="text-xs text-stone-500">Tell AI how to edit the instructions (e.g. "make it simpler", "add metric measurements")</p>
                    <input type="hidden" name="instructions" value={recipe.instructions} />
                    <Input
                        type="text"
                        name="aiPrompt"
                        placeholder="Your request…"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.currentTarget.value)}
                    />
                    <button name="_action" value="aiEditInstructions" type="submit" disabled={isAiLoading} className="self-end text-sm text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50">
                        {isAiLoading ? "Generating…" : "Generate"}
                    </button>
                    {isAiLoading && (
                        <p className="text-xs text-primary animate-pulse">AI is thinking, please wait…</p>
                    )}
                </div>
            )}
            {aiResult && (
                <div className="mb-3 p-3 border border-green-200 rounded-xl bg-green-50">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">AI Suggestion</p>
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(aiResult);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition-colors"
                        >
                            {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                    <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{aiResult}</p>
                </div>
            )}
            {!editingInstructions && <input type="hidden" name="instructions" value={recipe.instructions} />}
            {editingInstructions ? (
                <textarea
                    key={recipe.id}
                    id="instructions"
                    name="instructions"
                    placeholder="Enter your instructions"
                    onChange={(e) => saveInstructions(e.target.value)}
                    defaultValue={recipe.instructions}
                    ref={(el) => {
                         if (el) {
                        el.style.height = "auto";
                        el.style.height = el.scrollHeight + "px";
                    }}}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    className={classNames('w-full rounded-md outline-none resize-none overflow-hidden',
                        'border-2 border-stone-200 p-3 focus:border-primary duration-300'
                    )}
                    autoFocus
                />
            ) : (
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">
                    {recipe.instructions || <span className="text-stone-400 italic">No instructions yet. Click Edit to add.</span>}
                </p>
            )}
                <ErrorMessage>{(saveInstructionsFetcher.data as any)?.errors?.instructions ?? errors?.instructions}</ErrorMessage>
                <div className="flex justify-end mt-2">
                    <button name="_action" value="generateSummary" type="submit" disabled={isSummaryLoading} className="text-xs text-stone-400 hover:text-primary transition-colors disabled:opacity-50">
                        {isSummaryLoading ? "Generating…" : "✦ Generate Summary"}
                    </button>
                </div>
                <hr className="my-4" />
                <div className="flex items-center justify-between">
                    <DeleteButton name="_action" value="deleteRecipe" type="submit" className="flex items-center gap-2">Delete <TrashIcon /></DeleteButton>
                    {editRecipe && <SaveButton name="_action" value='saveRecipe' type="submit" className="flex items-center gap-2">Save <SaveIcon/></SaveButton>}
                </div>
                {(actionData as any)?.errors?._form && (
                    <ErrorMessage>{(actionData as any).errors._form}</ErrorMessage>
                )}

            

        </Form>
        
    )
}

type IngredientRowProps = {
    i: { id: string; name: string; amount: string | null };
    errors?: Record<string, string>;
};

function IngredientRow({ i, errors }: IngredientRowProps){
    return(
      <React.Fragment key={i.id}>
                        <input type="hidden" name="ingredientsId[]" value={i.id} />
                        <div>
                            <Input
                                type="text"
                                name="ingredientAmount[]"
                                defaultValue={i.amount??''}
                                placeholder="Amount"
                                variant="ghost"
                                error={!!errors?.ingredientAmount}
                            />
                            <ErrorMessage>{errors?.ingredientAmount}</ErrorMessage>
                        </div>
                        <div>
                            <Input
                                type="text"
                                name="ingredientName[]"
                                defaultValue={i.name}
                                placeholder="Name"
                                variant="ghost"
                                error={!!errors?.ingredientName}
                            />
                            <ErrorMessage>{errors?.ingredientName}</ErrorMessage>
                        </div>
                        <button
                            type="submit"
                            name="_action"
                            value="deleteIngredient"
                            className="flex font-bold text-stone-400 items-center justify-center hover:text-red-400 transition-colors"
                        >
                            <input type="hidden" name="ingredientId" value={i.id} />
                            <TrashIcon />
                        </button>
                    </React.Fragment>
    )

}