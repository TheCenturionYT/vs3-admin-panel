import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.pb.authStore.isValid) {
		const collection = locals.pb.authStore.record?.collectionName;
		redirect(303, collection === 'members' ? '/portal' : '/dashboard');
	}
	redirect(303, '/login');
};
