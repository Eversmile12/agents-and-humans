import React from "react";
import { createRoot } from "react-dom/client";
import { LiveGames } from "./components/Landing";
import { HeroChat } from "./components/HeroChat";

// Mount hero chat
const heroChatEl = document.getElementById("hero-chat");
if (heroChatEl) {
  createRoot(heroChatEl).render(<HeroChat />);
}

// Mount live games
const liveGamesEl = document.getElementById("live-games");
if (liveGamesEl) {
  createRoot(liveGamesEl).render(<LiveGames />);
}
