import React from "react";
import { createRoot } from "react-dom/client";
import { LiveGames } from "./components/Landing";

const container = document.getElementById("live-games")!;
const root = createRoot(container);
root.render(<LiveGames />);
