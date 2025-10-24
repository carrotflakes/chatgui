import { useEffect, useRef } from "react";

export type ChatMessage = {
  role: "developer" | "user";
  content: string;
  id?: undefined;
} | {
  role: "assistant";
  content: string;
  id: string;
};

function ChatLogs({
  log,
  assistantBlue = false,
}: {
  log: ChatMessage[];
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
          {msg.role === "developer" && (
            <div key={i} className="p-2 text-gray-500 whitespace-pre-wrap">
              {msg.content}
            </div>
          )}
          {msg.role === "user" && (
            <div
              key={i}
              className="self-end px-2 py-1 border border-gray-300 rounded-2xl text-gray-800 whitespace-pre-wrap"
            >
              {msg.content}
            </div>
          )}
          {msg.role === "assistant" && (
            <div
              key={i}
              className="self-start px-2 py-1 border border-gray-300 rounded-2xl data-[color='blue']:text-blue-500 data-[color='gray']:text-gray-800 whitespace-pre-wrap"
              data-color={assistantBlue ? "blue" : "gray"}
            >
              {msg.content}
            </div>
          )}
        </>
      ))}
      <div key="-1" ref={bottomRef} />
    </div>
  );
}

export default ChatLogs;
