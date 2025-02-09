import { useCallback, useMemo, useState } from "react";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const assistantPrompt = `You are one of the agents carrying out a task.
You can repeat the following three types of actions.
# Subtask Request
Ask other agents for a subtask.
Please clarify the end condition.
# Task Detail Inquiry
Ask the task requester for details.
They may not always reply.
# Task Completion Notification
Notify the task requester that the task is completed.`;

const assistantResponseFormat = zodResponseFormat(
  z.object({
    thought: z
      .string()
      .describe("Let's think step by step to figure out your next action."),
    action: z.union([
      z.object({
        type: z.literal("subtask_request"),
        subtask: z.object({
          detail: z.string(),
          title: z.string(),
        }),
      }),
      z.object({
        type: z.literal("task_detail_inquiry"),
        inquiry: z.string(),
      }),
      z.object({
        type: z.literal("task_completion_notification"),
        result: z.string(),
      }),
    ]),
  }),
  "Response"
);

const assistantResponseFormat2 = zodResponseFormat(
  z.object({
    thought: z.string(),
    action: z.object({
      type: z.literal("respond_to_inquiry"),
      message: z.string(),
    }),
  }),
  "Response2"
);

const MODEL_NAME = "gpt-4o-mini";
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
          messages: ChatCompletionMessageParam[];
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
          messages: ChatCompletionMessageParam[];
        }
    )[]
  >([]);

  const send = useCallback(async () => {
    const latestLog = log[log.length - 1];
    const messages: ChatCompletionMessageParam[] = !latestLog
      ? [
          {
            role: "system",
            content: assistantPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ]
      : [
          ...latestLog.messages,
          {
            role: "user",
            content: text,
          },
        ];
    const agentId = latestLog?.type === "agent" ? latestLog.agentId : 0;
    setLog((prev) => [...prev, { type: "user", content: text, messages }]);
    const res = await client.beta.chat.completions.parse({
      model: MODEL_NAME,
      messages,
      response_format: assistantResponseFormat,
    });
    console.log(res);
    const data = res.choices[0].message.parsed;
    if (!data)
      throw new Error("Invalid response format: " + JSON.stringify(res));
    setLog((prev) => [
      ...prev,
      {
        type: "agent",
        agentId,
        content: data.thought,
        action: data.action,
        messages: [
          ...messages,
          {
            role: "assistant",
            content: res.choices[0].message.content,
          },
        ],
      },
    ]);
  }, [client, log, text]);

  const invokeSubtask = useCallback(
    async (subtask: { title: string; detail: string }) => {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
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
      const res = await client.beta.chat.completions.parse({
        model: MODEL_NAME,
        messages,
        response_format: assistantResponseFormat,
      });
      console.log(res);
      const data = res.choices[0].message.parsed;
      if (!data)
        throw new Error("Invalid response format: " + JSON.stringify(res));
      const latestLog = log[log.length - 1];
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId: latestLog?.type === "agent" ? latestLog.agentId + 1 : 0,
          content: data.thought,
          action: data.action,
          messages: [
            ...messages,
            {
              role: "assistant",
              content: res.choices[0].message.content,
            },
          ],
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
      const messages: ChatCompletionMessageParam[] = [
        ...clientMessages,
        {
          role: "user",
          content: "Subtask executer asked: " + inquiry,
        },
      ];
      const res = await client.beta.chat.completions.parse({
        model: MODEL_NAME,
        messages,
        response_format: assistantResponseFormat2,
      });
      console.log(res);
      const response = res.choices[0].message.parsed;
      if (!response) return;
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
          messages: [
            ...messages,
            {
              role: "assistant",
              content: res.choices[0].message.content,
            },
          ],
        },
      ]);

      const messages2: ChatCompletionMessageParam[] = [
        ...latestLog.messages,
        {
          role: "user",
          content: response.action.message,
        },
      ];
      const res2 = await client.beta.chat.completions.parse({
        model: MODEL_NAME,
        messages: messages2,
        response_format: assistantResponseFormat,
      });
      console.log(res2);
      const data = res2.choices[0].message.parsed;
      if (!data)
        throw new Error("Invalid response format: " + JSON.stringify(res2));
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId,
          content: data.thought,
          action: data.action,
          messages: [
            ...messages2,
            {
              role: "assistant",
              content: res2.choices[0].message.content,
            },
          ],
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
      const messages: ChatCompletionMessageParam[] = [
        ...clientMessages,
        {
          role: "user",
          content: `Subtask completed: ${taskCompleteMessage}`,
        },
      ];
      const res = await client.beta.chat.completions.parse({
        model: MODEL_NAME,
        messages,
        response_format: assistantResponseFormat,
      });
      console.log(res);

      const data = res.choices[0].message.parsed;
      if (!data)
        throw new Error("Invalid response format: " + JSON.stringify(res));
      setLog((prev) => [
        ...prev,
        {
          type: "agent",
          agentId,
          content: data.thought,
          action: data.action,
          messages: [
            ...messages,
            {
              role: "assistant",
              content: res.choices[0].message.content,
            },
          ],
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

export default DeepThink;
