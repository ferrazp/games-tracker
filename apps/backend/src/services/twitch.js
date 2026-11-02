import logger from '../../db/logger.js';
import { config } from '../config.js';

let tokenCache = { value: null, expiresAt: 0 };

export async function getTwitchToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }
  const tokenResponse = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${config.twitch.clientId}&client_secret=${config.twitch.clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!tokenResponse.ok) {
    throw new Error(`Twitch auth failed: ${tokenResponse.status}`);
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('No access token in Twitch response');
  }
  tokenCache.value = tokenData.access_token;
  tokenCache.expiresAt = Date.now() + tokenData.expires_in * 1000;
  return tokenCache.value;
}
