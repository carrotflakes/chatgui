import OpenAI from "openai";
import { useState } from "react";
import { z, ZodType } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import Gui, { domHasInteractiveElements, State as GuiState } from "./Gui";
import ChatLogs, { type ChatMessage } from "./ChatLogs";

export const Dom: ZodType = z.lazy(() =>
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
      placeholder: z.string().nullable(),
    }),
    z.object({
      type: z.enum(["arrayV", "arrayH"]),
      array: z.array(Dom),
    }),
  ])
);

export const Response = z.object({
  think: z
    .string()
    .describe(
      "Put your thoughts here. This message is not displayed to the user."
    ),
  gui: Dom.describe("The GUI to display to the user."),
});

const INSTRUCTION = `You are a helpful assistant.
You only can communicate to the user through the GUI.
# GUI Example
{"type":"arrayV","array":[{"type":"text","text":"Hello, what is your name?"},{"type":"textInput","id":"name","placeholder":""},{"type":"button","text":"Submit","id":"submit"}]}
`;

function ChatGui() {
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<ChatMessage[]>([]);
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

    const messages: ChatMessage[] = [
      ...log,
      {
        role: "user",
        content: text,
      },
    ];
    setLog(messages);
    const res = await openai.responses.parse({
      model: "gpt-5-mini",
      input: [
        {
          role: "user",
          content: text,
        },
      ],
      instructions: INSTRUCTION,
      previous_response_id: log.at(-1)?.id,
      text: {
        format: zodTextFormat(Response, "response"),
      },
      reasoning: {
        effort: "low",
        summary: "auto",
      },
    });
    const parsed = res.output_parsed as z.infer<typeof Response> | null;
    if (parsed) {
      setGui(parsed.gui);
      setGuiState(null);
    }
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: res.output_text ?? "",
      id: res.id,
    };
    setLog([...messages, assistantMessage]);
    setIsLoading(false);
  };

  return (
    <div className="w-dvw h-dvh flex">
      {isLeftVisible && (
        <div className="w-1/2 h-full flex flex-col">
          <ChatLogs log={log} assistantBlue />
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
