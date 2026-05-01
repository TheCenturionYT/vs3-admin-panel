import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const items = await locals.pb.collection('sp_catalogue').getFullList({
		sort: 'category,name'
	});

	return {
		items: items.map((item) => ({
			id: item.id as string,
			name: item.name as string,
			category: item.category as string,
			sp_value: item.sp_value as number,
			demand_level: item.demand_level as string
		}))
	};
};
