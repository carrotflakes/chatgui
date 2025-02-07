import { Route, Routes } from "react-router";
import ChatGui from "./ChatGui";

function App() {
  return (
    <Routes>
      <Route index element={<ChatGui />} />
      <Route path="/gui" element={<ChatGui />} />
    </Routes>
  );
}

export default App;
