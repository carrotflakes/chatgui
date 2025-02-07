import { Route, Routes } from "react-router";
import ChatGui from "./ChatGui";
import { LookAhead } from "./LookAhead";

function App() {
  return (
    <Routes>
      <Route index element={<ChatGui />} />
      <Route path="/gui" element={<ChatGui />} />
      <Route path="/lookahead" element={<LookAhead />} />
    </Routes>
  );
}

export default App;
