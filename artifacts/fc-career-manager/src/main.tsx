import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { prefetchLeagueLogos } from "./lib/footballApiMap";

prefetchLeagueLogos().catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
