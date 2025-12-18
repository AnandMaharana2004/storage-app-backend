import { OAuth2Client } from "google-auth-library";
import envConfig from "./env.js";

export const GoogleAuthClient = new OAuth2Client({
  clientId: envConfig.GOOGLE_CLIENT_ID,
});
