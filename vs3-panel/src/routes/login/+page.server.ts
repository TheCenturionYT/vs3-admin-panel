import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Redirect authenticated users away from the login page
export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.pb.authStore.isValid) {
    const collectionName = locals.pb.authStore.record?.collectionName;
    if (collectionName === 'members') {
      redirect(303, '/portal');
    } else {
      redirect(303, '/dashboard');
    }
  }
  // Pass the expired flag so the page can show the session-expired notice
  return {
    expired: url.searchParams.has('expired')
  };
};

export const actions: Actions = {
  login: async ({ request, locals }) => {
    const data = await request.formData();
    const username = String(data.get('username') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!username || !password) {
      return fail(400, {
        error: 'Invalid username or password. Check your credentials and try again.',
        username
      });
    }

    // Try staff collection first
    try {
      await locals.pb.collection('staff').authWithPassword(username, password);
      redirect(303, '/dashboard');
    } catch (e) {
      if (isRedirect(e)) throw e;
      // Staff login failed — try members collection (portal users)
    }

    try {
      await locals.pb.collection('members').authWithPassword(username, password);
      redirect(303, '/portal');
    } catch (e) {
      if (isRedirect(e)) throw e;
      // Both collections failed
    }

    return fail(400, {
      error: 'Invalid username or password. Check your credentials and try again.',
      username
    });
  },

  logout: async ({ locals }) => {
    locals.pb.authStore.clear();
    redirect(303, '/login');
  }
};
