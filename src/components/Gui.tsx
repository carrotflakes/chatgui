export type Dom =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "button";
      text: string;
      id: string;
    }
  | {
      type: "textInput";
      id: string;
      placeholder?: string;
    }
  | {
      type: "arrayV" | "arrayH";
      array: Dom[];
    };

export type State =
  | null
  | {
      id: string;
      text: string;
    }
  | State[];

export default function Gui({
  dom,
  state,
  setState,
  onClickButton,
  disabled,
}: {
  dom: Dom;
  state: State;
  setState: (state: State) => void;
  onClickButton?: (id: string) => void;
  disabled?: boolean;
}) {
  if (dom.type === "text") {
    return <div className="whitespace-pre-wrap">{dom.text}</div>;
  }
  if (dom.type === "button") {
    return (
      <button
        className="p-2 bg-gray-100 rounded cursor-pointer disabled:opacity-50"
        onClick={() => onClickButton?.(dom.id)}
        disabled={disabled}
      >
        {dom.text}
      </button>
    );
  }
  if (dom.type === "textInput") {
    return (
      <input
        className="p-2 bg-gray-100 rounded"
        type="text"
        placeholder={dom.placeholder}
        value={state && "text" in state ? state?.text : ""}
        onChange={(event) => {
          setState({ id: dom.id, text: event.target.value });
        }}
      />
    );
  }
  if (dom.type === "arrayV") {
    return (
      <div className="p-2 flex flex-col gap-2">
        {dom.array.map((d, i) => (
          <Gui
            key={i}
            dom={d}
            state={Array.isArray(state) ? state[i] : null}
            setState={(s) => {
              const newState = Array.isArray(state) ? [...state] : [];
              newState[i] = s;
              setState(newState);
            }}
            onClickButton={onClickButton}
          />
        ))}
      </div>
    );
  }
  if (dom.type === "arrayH") {
    return (
      <div className="p-2 flex gap-2">
        {dom.array.map((d, i) => (
          <Gui
            key={i}
            dom={d}
            state={Array.isArray(state) ? state[i] : null}
            setState={(s) => {
              const newState = Array.isArray(state) ? [...state] : [];
              newState[i] = s;
              setState(newState);
            }}
            onClickButton={onClickButton}
          />
        ))}
      </div>
    );
  }
}

export function domHasInteractiveElements(dom: Dom): boolean {
  if (dom.type === "button") {
    return true;
  }
  if (dom.type === "arrayV" || dom.type === "arrayH") {
    return dom.array.some(domHasInteractiveElements);
  }
  return false;
}
