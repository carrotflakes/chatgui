import { useCallback, useMemo, useState } from "react";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ChatMessage } from "./ChatLogs";

const assistantPrompt = `You are one of the agents carrying out a task.
You can repeat the following three types of actions.
# Subtask Request
Ask other agents for a subtask.
Make your subtasks small enough relative to your main task.
Please clarify the end condition.
# Task Detail Inquiry
Ask the task requester for details.
They may not always reply.
# Task Completion Notification
Report the task result to the requester.`;

const AssistantResponseSchema = z.object({
  thought: z
    .string()
    .describe("Let's think step by step to figure out your next action."),
  action: z.union([
    z.object({
      type: z.literal("subtask_request"),
      subtask: z.object({
        detail: z
          .string()
          .describe(
            "Please write the task in detail. Only this will be passed on to the agent."
          ),
        title: z.string().describe("Provide a concise title for the subtask."),
      }),
    }),
    z.object({
      type: z.literal("task_detail_inquiry"),
      inquiry: z.string(),
    }),
    z.object({
      type: z.literal("task_completion_notification"),
      result: z.string().describe("Please write the result of the task."),
    }),
  ]),
});

const assistantResponseFormat = zodTextFormat(
  AssistantResponseSchema,
  "Response"
);

const AssistantResponseSchema2 = z.object({
  thought: z.string(),
  action: z.object({
    type: z.literal("respond_to_inquiry"),
    message: z.string(),
  }),
});

const assistantResponseFormat2 = zodTextFormat(
  AssistantResponseSchema2,
  "Response2"
);

const MODEL_NAME = "gpt-5-mini";
// const MODEL_NAME = "deepseek-chat";

function DeepThink() {
  const client = useMemo(
    () =>
      new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        // baseURL: "https://api.deepseek.com",
        // apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
        dangerouslyAllowBrowser: true,
      }),
    []
  );
  const [text, setText] = useState("");
  const [log, setLog] = useState<
    (
      | {
          type: "user";
          content: string;
          messages: ChatMessage[];
        }
      | {
          type: "agent";
          agentId: number;
          content: string;
          action:
            | {
                type: "subtask_request";
                subtask: {
                  detail: string;
                  title: string;
                };
              }
            | {
                type: "task_detail_inquiry";
                inquiry: string;
              }
            | {
                type: "task_completion_notification";
                result: string;
              }
            | { type: "respond_to_inquiry"; message: string };
          messages: ChatMessage[];
          id: string;
        }
    )[]
  >([]);

  const send = useCallback(async () => {
    const latestLog = log[log.length - 1];
    const messages: ChatMessage[] = [
      ...latestLog.messages,
      {
        role: "user",
        content: text,
      },
    ];
    const agentId = latestLog?.type === "agent" ? latestLog.agentId : 0;
    setLog((prev) => [...prev, { type: "user", content: text, messages }]);
    const res = await client.responses.parse({
      model: MODEL_NAME,
      input: toResponseInput(messages),
      instructions: assistantPrompt,
      text: { format: assistantResponseFormat },
    });
    console.log(res);
    const data = res.output_parsed as z.infer<
      typeof AssistantResponseSchema
    > | null;
    if (!data)
      throw new Error("Invalid response format: " + JSON.stringify(res));
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: res.output_text ?? "",
      id: res.id,
    };
    setLog((prev) => [
      ...prev,
      {
        type: "agent",
        agentId,
        content: data.thought,
        action: data.action,
        messages: [...messages, assistantMessage],
        id: res.id,
      },
    ]);
  }, [client, log, text]);

  const invokeSubtask = useCallback(
    async (subtask: { title: string; detail: string }) => {
      const messages: ChatMessage[] = [
        {
          role: "developer",
          content: assistantPrompt,
        },
        {
          role: "user",
          content: subtask.detail,
        },
      ];
      setLog((prev) => [
        ...prev,
        {
          type: "user",
          content: subtask.detail,
          messages,
        },
      ]);
      const res = await client.responses.parse({
        model: MODEL_NAME,
        input: toResponseInput(messages),
        text: { format: assistantResponseFormat },
      });
      console.log(res);
      const data = res.output_parsed as z.infer<
        typeof AssistantResponseSchema
      > | null;
      if (!data)
        throw new Error("Invalid response format: " + JSON.stringify(res));
      const latestLog = log[log.length - 1];
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.output_text ?? "",
        id: res.id,
      };
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId: latestLog?.type === "agent" ? latestLog.agentId + 1 : 0,
          content: data.thought,
          action: data.action,
          messages: [...messages, assistantMessage],
          id: res.id,
        },
      ]);
    },
    [client, log]
  );

  const replyToInquiry = useCallback(
    async (inquiry: string) => {
      const latestLog = log[log.length - 1];
      const agentId = latestLog?.type === "agent" ? latestLog.agentId : 0;
      const clientMessages = [...log]
        .reverse()
        .find(
          (entry) => entry.type === "agent" && entry.agentId < agentId
        )?.messages;
      if (!clientMessages) return;
      const messages: ChatMessage[] = [
        ...clientMessages,
        {
          role: "user",
          content: "Subtask executer asked: " + inquiry,
        },
      ];
      const res = await client.responses.parse({
        model: MODEL_NAME,
        input: toResponseInput(messages),
        response_format: assistantResponseFormat2,
      });
      console.log(res);
      const response = res.output_parsed as z.infer<
        typeof AssistantResponseSchema2
      > | null;
      if (!response) return;
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.output_text ?? "",
        id: res.id,
      };
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId: agentId - 1,
          content: response.thought,
          action: {
            type: "respond_to_inquiry",
            message: response.action.message,
          },
          messages: [...messages, assistantMessage],
          id: res.id,
        },
      ]);

      const messages2: ChatMessage[] = [
        ...latestLog.messages,
        {
          role: "user",
          content: response.action.message,
        },
      ];
      const res2 = await client.responses.parse({
        model: MODEL_NAME,
        input: toResponseInput(messages2),
        text: { format: assistantResponseFormat },
      });
      console.log(res2);
      const data = res2.output_parsed as z.infer<
        typeof AssistantResponseSchema
      > | null;
      if (!data)
        throw new Error("Invalid response format: " + JSON.stringify(res2));
      const assistantMessage2: ChatMessage = {
        role: "assistant",
        content: res2.output_text ?? "",
        id: res2.id,
      };
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId,
          content: data.thought,
          action: data.action,
          messages: [...messages2, assistantMessage2],
          id: res2.id,
        },
      ]);
    },
    [client, log]
  );

  const notifyTaskCompletion = useCallback(
    async (taskCompleteMessage: string) => {
      const latestLog = log[log.length - 1];
      const agentId = latestLog?.type === "agent" ? latestLog.agentId : 0;
      const clientMessages = [...log]
        .reverse()
        .find(
          (entry) => entry.type === "agent" && entry.agentId < agentId
        )?.messages;
      if (!clientMessages) return;
      const messages: ChatMessage[] = [
        ...clientMessages,
        {
          role: "user",
          content: `Subtask completed: ${taskCompleteMessage}`,
        },
      ];
      const res = await client.responses.parse({
        model: MODEL_NAME,
        input: toResponseInput(messages),
        text: { format: assistantResponseFormat },
      });
      console.log(res);

      const data = res.output_parsed as z.infer<
        typeof AssistantResponseSchema
      > | null;
      if (!data)
        throw new Error("Invalid response format: " + JSON.stringify(res));
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.output_text ?? "",
        id: res.id,
      };
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId,
          content: data.thought,
          action: data.action,
          messages: [...messages, assistantMessage],
          id: res.id,
        },
      ]);
    },
    [client, log]
  );

  function clearLog() {
    setLog([]);
  }

  const latestLog = log[log.length - 1];

  return (
    <div className="w-dvw h-dvh p-4">
      <textarea
        className="border rounded w-full h-32 p-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter task details"
      />
      <button
        onClick={send}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Send
      </button>
      <button
        onClick={clearLog}
        className="mt-2 px-4 py-2 bg-red-500 text-white rounded ml-2"
      >
        Clear
      </button>
      <div className="mt-4 space-y-4">
        {log.map((entry, i) => (
          <div key={i} className="p-2 bg-white border rounded">
            <div className="font-semibold">
              {entry.type === "user" ? "user" : "agent" + entry.agentId}
            </div>
            <div className="italic">{entry.content}</div>
            <div>
              {entry.type === "agent" &&
                (entry.action.type === "subtask_request" ? (
                  <>
                    <div>Subtask Request</div>
                    <div>{entry.action.subtask.title}</div>
                    <div>{entry.action.subtask.detail}</div>
                  </>
                ) : entry.action.type === "task_detail_inquiry" ? (
                  <>
                    <div>Task Detail Inquiry</div>
                    <div>{entry.action.inquiry}</div>
                  </>
                ) : entry.action.type === "task_completion_notification" ? (
                  <>
                    <div>Task Completion Notification</div>
                    <div>{entry.action.result}</div>
                  </>
                ) : entry.action.type === "respond_to_inquiry" ? (
                  <>
                    <div>Respond to Inquiry</div>
                    <div>{entry.action.message}</div>
                  </>
                ) : null)}
            </div>
          </div>
        ))}
        {latestLog?.type === "agent" &&
          latestLog.action.type === "subtask_request" && (
            <button
              onClick={() =>
                latestLog.action.type === "subtask_request" &&
                invokeSubtask(latestLog.action.subtask)
              }
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Invoke subtask
            </button>
          )}
        {latestLog?.type === "agent" &&
          latestLog.action.type === "task_detail_inquiry" && (
            <button
              onClick={() =>
                latestLog.action.type === "task_detail_inquiry" &&
                replyToInquiry(latestLog.action.inquiry)
              }
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Reply to inquiry
            </button>
          )}
        {latestLog?.type === "agent" &&
          latestLog.action.type === "task_completion_notification" && (
            <button
              onClick={() =>
                latestLog.action.type === "task_completion_notification" &&
                notifyTaskCompletion(latestLog.action.result)
              }
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Notify task completion
            </button>
          )}
      </div>
    </div>
  );
}

const toResponseInput = (messages: ChatMessage[]) =>
  messages.map(({ role, content }) => ({
    role,
    content,
  }));

export default DeepThink;
