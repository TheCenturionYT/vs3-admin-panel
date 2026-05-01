import PocketBase from 'pocketbase';
import type { Handle } from '@sveltejs/kit';
import { getPocketBaseUrl } from '$lib/server/pocketbase';

export const handle: Handle = async ({ event, resolve }) => {
  // Create a fresh PocketBase instance per request (SSR — do not share state between requests)
  event.locals.pb = new PocketBase(getPocketBaseUrl());

  // Load auth state from the incoming request cookie
  event.locals.pb.authStore.loadFromCookie(
    event.request.headers.get('cookie') || ''
  );

  // Refresh the token if the auth store is populated
  // CRITICAL: Must call authRefresh() on the collection the user authenticated against.
  // The SDK example uses collection('users') but this project uses 'staff' and 'members'.
  // Calling the wrong collection causes a 404 which silently clears the auth store,
  // logging the user out on every page load.
  if (event.locals.pb.authStore.isValid) {
    const collectionName = event.locals.pb.authStore.record?.collectionName;
    try {
      if (collectionName === 'staff') {
        await event.locals.pb.collection('staff').authRefresh();
      } else if (collectionName === 'members') {
        await event.locals.pb.collection('members').authRefresh();
      }
    } catch {
      // Token is invalid or expired — clear it
      event.locals.pb.authStore.clear();
    }
  }

  const response = await resolve(event);

  // Write the updated auth cookie back to the client on every response.
  // httpOnly: true — prevents JS access (XSS protection)
  // secure: true in production — HTTPS only (Railway is HTTPS)
  // sameSite: Strict — prevents CSRF
  response.headers.append(
    'set-cookie',
    event.locals.pb.authStore.exportToCookie({
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/'
    })
  );

  return response;
};
