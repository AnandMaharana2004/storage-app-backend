import envConfig from "../config/env.js";
import { GoogleAuthClient } from "../config/google.config.js";

export async function verifyIdToken(idToken) {
  const loginTicket = await GoogleAuthClient.verifyIdToken({
    idToken,
    audience: envConfig.GOOGLE_CLIENT_ID,
  });

  const userData = loginTicket.getPayload();
  return userData;
}
