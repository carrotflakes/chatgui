import { useState, useRef, useEffect, useCallback } from "react";
import OpenAI from "openai";

const Canvas = () => {
  const [text, setText] = useState("");
  const textRef = useRef<string>(text);
  const [instruction, setInstruction] = useState("");
  const [interimText, setInterimText] = useState("");
  const [interimInstruction, setInterimInstruction] = useState("");
  const [listeningMode, setListeningMode] = useState<
    "text" | "instruction" | null
  >(null);
  const [aiLoading, setAiLoading] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningModeRef = useRef(listeningMode);

  // sync ref for onresult handler
  useEffect(() => {
    listeningModeRef.current = listeningMode;
  }, [listeningMode]);

  // sync textRef with state
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const handleAIEdit = useCallback(async (instruction: string) => {
    setAiLoading(true);
    try {
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });
      const res = await openai.responses.create({
        model: "gpt-5-mini",
        instructions:
          "You are a text editing assistant. Follow the user's instructions to edit the provided text. You only need to respond with the edited text.",
        input: [
          {
            role: "user",
            content: `Instruction: ${instruction}\n\nText:\n${textRef.current}`,
          },
        ],
      });
      const edited = res.output_text ?? "";
      setText(edited);
      setInstruction("");
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "ja-JP";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onresult = async (event: SpeechRecognitionEvent) => {
        let interm = "",
          finalT = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const tr = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalT += tr;
          else interm += tr;
        }
        if (listeningModeRef.current === "text") {
          if (finalT) setText((prev) => prev + finalT);
          setInterimText(interm);
        }
        if (listeningModeRef.current === "instruction") {
          if (finalT) {
            setInstruction((prev) => prev + finalT);
            stopListening();
            await handleAIEdit(finalT);
            recognitionRef.current?.start();
            setListeningMode("instruction");
          } else {
            setInterimInstruction(interm);
          }
        }
      };
      recognition.onerror = (e) => {
        console.error(e);
        stopListening();
      };
      recognitionRef.current = recognition;
    } else {
      console.warn("SpeechRecognition API not supported");
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, [handleAIEdit]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListeningMode(null);
    setInterimText("");
    setInterimInstruction("");
  };

  const toggleTextListening = () =>
    listeningMode === "text"
      ? stopListening()
      : (stopListening(),
        setListeningMode("text"),
        setInterimText(""),
        recognitionRef.current?.start());

  const toggleInstructionListening = () =>
    listeningMode === "instruction"
      ? stopListening()
      : (stopListening(),
        setListeningMode("instruction"),
        setInterimInstruction(""),
        recognitionRef.current?.start());

  return (
    <div className="fixed inset-0">
      {listeningMode === "text" && (
        <div className="absolute top-0 left-0 right-0 p-2 bg-gray-100">
          {interimText}
        </div>
      )}
      {listeningMode === "instruction" && (
        <div className="absolute top-0 left-0 right-0 p-2 bg-yellow-100">
          Instruction: {interimInstruction}
        </div>
      )}
      {instruction && (
        <div className="p-2 bg-green-100">
          Current instruction: {instruction}
        </div>
      )}
      <textarea
        className="w-full h-full p-4 border-none focus:outline-none resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          className="p-2 bg-gray-400 text-white rounded disabled:opacity-50 cursor-pointer"
          onClick={toggleTextListening}
          disabled={aiLoading}
        >
          {listeningMode === "text" ? "Stop Text Input" : "Start Text Input"}
        </button>
        <button
          className="p-2 bg-gray-400 text-white rounded disabled:opacity-50 cursor-pointer"
          onClick={toggleInstructionListening}
          disabled={aiLoading}
        >
          {listeningMode === "instruction"
            ? "Stop Instruction Input"
            : "Start Instruction Input"}
        </button>
      </div>
    </div>
  );
};

export default Canvas;
