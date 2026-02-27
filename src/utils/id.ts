import { nanoid } from "nanoid";
import { config } from "../config";

export const generateAgentId = () => config.prefixes.agent + nanoid(12);
export const generateGameId = () => config.prefixes.game + nanoid(8);
export const generatePlayerId = () => config.prefixes.player + nanoid(10);
export const generateInviteCode = () => nanoid(6).toUpperCase();
