import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import.meta.glob("./styles/local.css", { eager: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
