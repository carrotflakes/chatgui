import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { useEffect, useRef } from "react";

function ChatLogs({
  log,
  assistantBlue = false,
}: {
  log: ChatCompletionMessageParam[];
  assistantBlue?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  return (
    <div className="grow p-2 flex flex-col gap-2 overflow-auto">
      {log.map((msg, i) => (
        <>
          {msg.role === "system" && (
            <div key={i} className="p-2 text-gray-500 whitespace-pre-wrap">
              {typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content)}
            </div>
          )}
          {msg.role === "user" && (
            <div
              key={i}
              className="self-end px-2 py-1 border border-gray-300 rounded-2xl text-gray-800 whitespace-pre-wrap"
            >
              {typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content)}
            </div>
          )}
          {msg.role === "assistant" && (
            <div
              key={i}
              className="self-start px-2 py-1 border border-gray-300 rounded-2xl data-[color='blue']:text-blue-500 data-[color='gray']:text-gray-800 whitespace-pre-wrap"
              data-color={assistantBlue ? "blue" : "gray"}
            >
              {typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content)}
            </div>
          )}
        </>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export default ChatLogs;
