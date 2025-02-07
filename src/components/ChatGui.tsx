import OpenAI from "openai";
import { useState } from "react";
import { z, ZodType } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import Gui, { domHasInteractiveElements, State as GuiState } from "./Gui";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const Dom: ZodType = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
    z.object({
      type: z.literal("button"),
      text: z.string(),
      id: z.string(),
    }),
    z.object({
      type: z.literal("textInput"),
      id: z.string(),
      placeholder: z.string().optional(),
    }),
    z.object({
      type: z.enum(["arrayV", "arrayH"]),
      array: z.array(Dom),
    }),
  ])
);

const Response = z.object({
  think: z
    .string()
    .describe(
      "Put your thoughts here. This message is not displayed to the user."
    ),
  gui: Dom.describe("The GUI to display to the user."),
});

function ChatGui() {
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<ChatCompletionMessageParam[]>([
    {
      role: "system",
      content: `You are a helpful assistant.
You only can communicate to the user through the GUI.
# GUI Example
{"type":"arrayV","array":[{"type":"text","text":"Hello, what is your name?"},{"type":"textInput","id":"name","placeholder":""},{"type":"button","text":"Submit","id":"submit"}]}
`,
    },
  ]);
  const [, setResponse] = useState<z.infer<typeof Response>[]>([]);
  const [gui, setGui] = useState<z.infer<typeof Dom>>({
    type: "text",
    text: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [guiState, setGuiState] = useState<GuiState>(null);
  const [isLeftVisible, setIsLeftVisible] = useState(true);

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
      response_format: zodResponseFormat(Response, "response"),
    });
    const parsed = res.choices[0].message.parsed;
    if (parsed) {
      setGui(parsed.gui);
      setGuiState(null);
      setResponse((prev) => [...prev, parsed]);
    }
    setLog([...messages, res.choices[0].message]);
    setIsLoading(false);
  };

  return (
    <div className="w-dvw h-dvh flex">
      {isLeftVisible && (
        <div className="w-1/2 h-full flex flex-col">
          <div className="grow p-2 flex flex-col gap-2 overflow-auto">
            {log.map((msg, i) => (
              <>
                {msg.role === "system" && (
                  <div key={i} className="p-2 text-gray-500">
                    {typeof msg.content === "string"
                      ? msg.content
                      : JSON.stringify(msg.content)}
                  </div>
                )}
                {msg.role === "user" && (
                  <div
                    key={i}
                    className="self-end px-2 py-1 border border-gray-300 rounded-2xl text-gray-800"
                  >
                    {typeof msg.content === "string"
                      ? msg.content
                      : JSON.stringify(msg.content)}
                  </div>
                )}
                {msg.role === "assistant" && (
                  <div
                    key={i}
                    className="self-start px-2 py-1 border border-gray-300 rounded-2xl text-blue-500"
                  >
                    {typeof msg.content === "string"
                      ? msg.content
                      : JSON.stringify(msg.content)}
                  </div>
                )}
              </>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(prompt);
            }}
            className="w-full p-2 flex items-stretch gap-2 border-t border-gray-300"
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
      )}
      <div className="w-px h-full bg-gray-300"></div>
      <div className="grow h-full p-4 flex flex-col gap-2 justify-center items-center">
        <Gui
          dom={gui}
          state={guiState}
          setState={setGuiState}
          onClickButton={(id) => {
            send(
              `User clicked button with id: ${id}` +
                (guiState ? `\nGUI state: ${JSON.stringify(guiState)}` : "")
            );
          }}
          disabled={isLoading}
        />
        {log.length > 1 && !domHasInteractiveElements(gui) && (
          <button
            className="p-2 bg-gray-100 rounded cursor-pointer disabled:opacity-50"
            onClick={() => {
              send(
                guiState ? `\nGUI state: ${JSON.stringify(guiState)}` : "Go on."
              );
            }}
            disabled={isLoading}
          >
            Continue
          </button>
        )}
      </div>
      <button
        className="absolute top-4 left-4 w-8 h-8 flex justify-center items-center bg-[#fff6] hover:opacity-90 text-black font-bold rounded-full cursor-pointer backdrop-blur-[1px]"
        onClick={() => setIsLeftVisible(!isLeftVisible)}
      >
        {isLeftVisible ? "<" : ">"}
      </button>
    </div>
  );
}

export default ChatGui;
