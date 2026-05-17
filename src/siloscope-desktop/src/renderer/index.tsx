import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ color: "white", padding: "50px", textAlign: "center" }}>
      <h1>SiloScope</h1>
      <p>React is working!</p>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);