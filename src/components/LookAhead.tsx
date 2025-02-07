import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { useState } from "react";
import ChatLogs from "./ChatLogs";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export function LookAhead() {
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<ChatCompletionMessageParam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const send = async (text: string) => {
    setIsLoading(true);
    const openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    const messages: ChatCompletionMessageParam[] = [
      ...log,
      {
        role: "user",
        content: text,
      },
    ];
    setLog(messages);
    const res = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: messages.map((msg) => ({
        ...msg,
        parsed: undefined,
        tool_calls: undefined,
      })),
    });
    setLog([...messages, res.choices[0].message]);
    const sgsts = await suggestion([...messages, res.choices[0].message]);
    setSuggestions(sgsts?.expects ?? []);

    setIsLoading(false);
  };

  return (
    <div className="w-dvw h-dvh flex flex-col">
      <ChatLogs log={log} />
      <div className="w-full p-2 flex flex-col gap-2 border-t border-gray-300">
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 overflow-y-auto">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                className="px-2 py-1 border border-gray-300 rounded-2xl text-gray-800 cursor-pointer"
                onClick={() => {
                  setPrompt(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(prompt);
          }}
          className="flex items-stretch gap-2"
        >
          <textarea
            className="p-2 border border-gray-300 rounded w-full resize-none"
            rows={3}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            placeholder="Enter your prompt"
          />
          <button
            type="submit"
            className="p-2 bg-blue-500 text-white rounded cursor-pointer disabled:opacity-50"
            disabled={isLoading}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

export const Response = z.object({
  expects: z.array(z.string()),
});

async function suggestion(log: ChatCompletionMessageParam[]) {
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const res = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      ...log.map((msg) => ({
        ...msg,
        parsed: undefined,
        tool_calls: undefined,
      })),
      {
        role: "system",
        content:
          "Predict what the user will say next.\n\nYou can use placeholders so the user can replace them with any named entities, such as `I like {food}`.",
      },
    ],
    response_format: zodResponseFormat(Response, "response"),
  });
  const parsed = res.choices[0].message.parsed;
  if (parsed) {
    console.log(parsed.expects);
  }
  return parsed;
}
