import { Route, Routes } from "react-router";
import ChatGui from "./ChatGui";
import DeepThink from "./DeepThink";
import { LookAhead } from "./LookAhead";

function App() {
  return (
    <Routes>
      <Route index element={<ChatGui />} />
      <Route path="/gui" element={<ChatGui />} />
      <Route path="/lookahead" element={<LookAhead />} />
      <Route path="/deepthink" element={<DeepThink />} />
    </Routes>
  );
}

export default App;
