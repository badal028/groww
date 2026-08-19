import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGoogleAnalytics } from "./lib/analytics";

initGoogleAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
