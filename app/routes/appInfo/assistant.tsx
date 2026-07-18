import React from "react";
import classNames from "classnames";
import type { Route } from "./+types/assistant";

export function meta(): ReturnType<Route.MetaFunction> {
  return [{ title: "Chef · PantryChef" }];
}

type AgentEvent =
  | { type: "thought"; text: string }
  | { type: "tool_call"; tool: string; args: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "answer"; text: string }
  | { type: "error"; message: string };

type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "agent"; events: AgentEvent[]; done: boolean };

const SUGGESTIONS = [
  "What can I cook tonight with what I have?",
  "Add the ingredients for a simple tomato pasta to my pantry",
  "Create a recipe that uses up my eggs and flour",
  "What am I running low on for my saved recipes?",
];

const TOOL_LABELS: Record<string, string> = {
  get_pantry: "Reading pantry",
  add_pantry_items: "Adding pantry items",
  remove_pantry_item: "Removing pantry item",
  list_recipes: "Reading recipes",
  create_recipe: "Saving recipe",
};

export default function Assistant() {
  const [entries, setEntries] = React.useState<ChatEntry[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setInput("");
    setEntries(prev => [...prev, { kind: "user", text: message }, { kind: "agent", events: [], done: false }]);

    const pushEvent = (event: AgentEvent) =>
      setEntries(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.kind === "agent") next[next.length - 1] = { ...last, events: [...last.events, event] };
        return next;
      });

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            pushEvent(JSON.parse(line) as AgentEvent);
          } catch {
            /* skip malformed line */
          }
        }
      }
    } catch (error) {
      pushEvent({ type: "error", message: error instanceof Error ? error.message : "Something went wrong" });
    } finally {
      setEntries(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.kind === "agent") next[next.length - 1] = { ...last, done: true };
        return next;
      });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto px-6">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-8 flex flex-col gap-6">
        {entries.length === 0 ? (
          <div className="my-auto text-center">
            <div className="text-5xl mb-4" aria-hidden>🍳</div>
            <h1 className="font-serif text-3xl text-stone-800 mb-2">Chef</h1>
            <p className="text-stone-500 text-sm mb-8 max-w-md mx-auto">
              An assistant that can actually <em>do</em> things — read your pantry, add ingredients,
              save recipes — and shows you every step it takes.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-4 py-2 rounded-full border border-stone-200 text-sm text-stone-600 hover:border-primary hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          entries.map((entry, i) =>
            entry.kind === "user" ? (
              <div key={i} className="self-end max-w-[85%] bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px]">
                {entry.text}
              </div>
            ) : (
              <AgentTurn key={i} entry={entry} />
            ),
          )
        )}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
        className="pb-8 pt-2"
      >
        <div className="flex gap-2 items-end rounded-2xl border border-stone-200 bg-white p-2 shadow-sm focus-within:border-primary transition-colors">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Chef to plan, add, or create…"
            disabled={busy}
            className="flex-1 px-3 py-2 outline-none bg-transparent text-[15px] text-stone-700 placeholder:text-stone-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary-light transition-colors"
          >
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

// A tool_call event (spinner) and its later tool_result (checkmark) describe
// one step, not two — pair them by tool name in call order so the result
// replaces the spinner instead of both rendering as separate list items.
type ToolStep = { kind: "tool"; tool: string; result?: unknown; failed?: boolean };
type Step = { kind: "thought"; text: string } | ToolStep;

function pairEvents(events: AgentEvent[]): Step[] {
  const steps: Step[] = [];
  const pending: Record<string, ToolStep[]> = {};

  for (const event of events) {
    if (event.type === "thought") {
      steps.push({ kind: "thought", text: event.text });
    } else if (event.type === "tool_call") {
      const step: Step = { kind: "tool", tool: event.tool };
      steps.push(step);
      (pending[event.tool] ??= []).push(step);
    } else if (event.type === "tool_result") {
      const waiting = pending[event.tool]?.shift();
      const failed = typeof event.result === "object" && event.result !== null && "error" in (event.result as object);
      if (waiting) {
        waiting.result = event.result;
        waiting.failed = failed;
      } else {
        steps.push({ kind: "tool", tool: event.tool, result: event.result, failed });
      }
    }
  }
  return steps;
}

function AgentTurn({ entry }: { entry: ChatEntry & { kind: "agent" } }) {
  const answer = entry.events.find(e => e.type === "answer");
  const error = entry.events.find(e => e.type === "error");
  const steps = pairEvents(entry.events);

  return (
    <div className="self-start max-w-[92%] w-full">
      {steps.length > 0 && (
        <ol className="flex flex-col gap-1.5 mb-3">
          {steps.map((step, i) => (
            <AgentStep key={i} step={step} />
          ))}
        </ol>
      )}
      {!entry.done && !answer && (
        <div className="flex items-center gap-2 text-stone-400 text-sm pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Chef is working…
        </div>
      )}
      {answer && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl rounded-bl-md px-4 py-3 text-[15px] text-stone-700 whitespace-pre-wrap leading-relaxed">
          {answer.text}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 text-sm text-red-700">
          {error.message}
        </div>
      )}
    </div>
  );
}

function AgentStep({ step }: { step: Step }) {
  const [open, setOpen] = React.useState(false);

  if (step.kind === "thought") {
    return <li className="text-[13px] text-stone-400 italic pl-1">{step.text}</li>;
  }

  // Still in flight — no result yet.
  if (step.result === undefined) {
    return (
      <li className="flex items-center gap-2 text-[13px] text-stone-500 pl-1">
        <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" style={{ animationDuration: "0.8s" }} />
        {TOOL_LABELS[step.tool] ?? step.tool}
      </li>
    );
  }

  return (
    <li className="pl-1">
      <button
        onClick={() => setOpen(o => !o)}
        className={classNames(
          "inline-flex items-center gap-1.5 text-[13px] rounded-full border px-2.5 py-0.5 transition-colors",
          step.failed
            ? "border-red-300 text-red-600 bg-red-50"
            : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:border-emerald-400",
        )}
      >
        <span aria-hidden>{step.failed ? "✕" : "✓"}</span>
        {TOOL_LABELS[step.tool] ?? step.tool}
        <span className="text-[11px] opacity-60">{open ? "hide" : "details"}</span>
      </button>
      {open && (
        <pre className="mt-1.5 p-3 rounded-lg bg-stone-100 text-[12px] text-stone-600 overflow-x-auto max-h-48">
          {JSON.stringify(step.result, null, 2)}
        </pre>
      )}
    </li>
  );
}
