import PocketBase from 'pocketbase';

/**
 * Returns the PocketBase server URL from environment variables.
 * POCKETBASE_URL — internal URL for runtime (Docker/Railway private network)
 * Falls back to localhost for local development.
 *
 * NEVER use this for client-side code. Use PUBLIC_POCKETBASE_URL in Svelte components.
 */
export function getPocketBaseUrl(): string {
  return process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
}
