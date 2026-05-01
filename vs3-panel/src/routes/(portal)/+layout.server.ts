import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.pb.authStore.isValid) {
    redirect(303, '/login?expired=true');
  }

  const collectionName = locals.pb.authStore.record?.collectionName;
  if (collectionName !== 'members') {
    redirect(303, '/dashboard');
  }

  const record = locals.pb.authStore.record;
  return {
    user: {
      id: record?.id as string,
      username: record?.username as string,
      factionId: record?.faction as string
    }
  };
};
