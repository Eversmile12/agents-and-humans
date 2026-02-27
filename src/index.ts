import { app } from "./api/app";
import { config } from "./config";
import { gameManager } from "./engine/game-manager";
import { gameScheduler } from "./engine/game-scheduler";
import landing from "./public/landing.html";
import spectate from "./public/spectate.html";

// Restore any in-progress games, then start the scheduler
gameManager.restoreActiveGames().then(() => {
  console.log("Game manager initialized");
  gameScheduler.start();
});

Bun.serve({
  routes: {
    "/": landing,
    "/skill.md": async () => {
      const file = Bun.file(import.meta.dir + "/public/skill.md");
      return new Response(file, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    },
    "/assets/:filename": async (req) => {
      const file = Bun.file(import.meta.dir + "/public/assets/" + req.params.filename);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },
    "/spectate/:gameId": spectate,
  },
  fetch: app.fetch,
  port: config.port,
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(
  `Agents & Humans server running at http://localhost:${config.port}`
);
