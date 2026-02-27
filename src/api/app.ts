import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error-handler";
import { agentRoutes } from "./routes/agents";
import { gameRoutes } from "./routes/games";
import { stateRoutes } from "./routes/state";
import { nightRoutes } from "./routes/night";
import { dayRoutes } from "./routes/day";
import { spectatorRoutes } from "./routes/spectator";

export const app = new Hono().basePath("/api/v1");

app.use("*", cors());
app.onError(errorHandler);

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/agents", agentRoutes);
// Spectator routes first (no auth) — must be before game routes
app.route("/spectate", spectatorRoutes);
app.route("/games", gameRoutes);
app.route("/games", stateRoutes);
app.route("/games", nightRoutes);
app.route("/games", dayRoutes);
