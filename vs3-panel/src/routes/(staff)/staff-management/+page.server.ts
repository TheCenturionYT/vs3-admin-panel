import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

// Validation schemas
const createStaffSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(['staff', 'head_admin'], { message: 'Role is required.' })
});

const createMemberSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  factionId: z.string().min(1, 'Faction is required.')
});

const updateStaffSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8).optional().or(z.literal('')),
  role: z.enum(['staff', 'head_admin'])
});

const updateMemberSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8).optional().or(z.literal('')),
  factionId: z.string().min(1, 'Faction is required.')
});

const toggleSchema = z.object({
  id: z.string().min(1),
  collection: z.enum(['staff', 'members'])
});

export const load: PageServerLoad = async ({ locals }) => {
  const [staffAccounts, memberAccounts, factions] = await Promise.all([
    locals.pb.collection('staff').getFullList({
      sort: 'username',
      fields: 'id,username,role,isActive,lastLogin'
    }),
    locals.pb.collection('members').getFullList({
      sort: 'username',
      expand: 'faction',
      fields: 'id,username,isActive,faction,expand'
    }),
    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name'
    })
  ]);

  return {
    staffAccounts: staffAccounts.map(a => ({
      id: a.id as string,
      username: a.username as string,
      role: a.role as 'head_admin' | 'staff',
      isActive: a.isActive as boolean,
      lastLogin: a.lastLogin as string | null
    })),
    memberAccounts: memberAccounts.map(a => ({
      id: a.id as string,
      username: a.username as string,
      isActive: a.isActive as boolean,
      factionId: a.faction as string,
      factionName: (a.expand?.faction?.name as string) ?? '—'
    })),
    factions: factions.map(f => ({
      id: f.id as string,
      name: f.name as string
    }))
  };
};

export const actions: Actions = {
  createStaff: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = createStaffSchema.safeParse({
      username: data.get('username'),
      password: data.get('password'),
      role: data.get('role')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'createStaff',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('staff').create({
        username: parsed.data.username,
        password: parsed.data.password,
        passwordConfirm: parsed.data.password,
        role: parsed.data.role,
        isActive: true
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('username')) {
        return fail(400, {
          action: 'createStaff',
          errors: { username: ['This username is already in use. Choose a different one.'] },
          values: Object.fromEntries(data)
        });
      }
      return fail(500, {
        action: 'createStaff',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'createStaff' };
  },

  createMember: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = createMemberSchema.safeParse({
      username: data.get('username'),
      password: data.get('password'),
      factionId: data.get('factionId')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'createMember',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    try {
      await locals.pb.collection('members').create({
        username: parsed.data.username,
        password: parsed.data.password,
        passwordConfirm: parsed.data.password,
        faction: parsed.data.factionId,
        isActive: true
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('username')) {
        return fail(400, {
          action: 'createMember',
          errors: { username: ['This username is already in use. Choose a different one.'] },
          values: Object.fromEntries(data)
        });
      }
      return fail(500, {
        action: 'createMember',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'createMember' };
  },

  updateStaff: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = updateStaffSchema.safeParse({
      id: data.get('id'),
      password: data.get('password') || undefined,
      role: data.get('role')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'updateStaff',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    const update: Record<string, unknown> = { role: parsed.data.role };
    if (parsed.data.password) {
      update.password = parsed.data.password;
      update.passwordConfirm = parsed.data.password;
    }

    try {
      await locals.pb.collection('staff').update(parsed.data.id, update);
    } catch {
      return fail(500, { action: 'updateStaff', errors: { _global: ['Something went wrong. Please try again.'] } });
    }

    return { success: true, action: 'updateStaff' };
  },

  updateMember: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = updateMemberSchema.safeParse({
      id: data.get('id'),
      password: data.get('password') || undefined,
      factionId: data.get('factionId')
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'updateMember',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    const update: Record<string, unknown> = { faction: parsed.data.factionId };
    if (parsed.data.password) {
      update.password = parsed.data.password;
      update.passwordConfirm = parsed.data.password;
    }

    try {
      await locals.pb.collection('members').update(parsed.data.id, update);
    } catch {
      return fail(500, { action: 'updateMember', errors: { _global: ['Something went wrong. Please try again.'] } });
    }

    return { success: true, action: 'updateMember' };
  },

  deactivateAccount: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = toggleSchema.safeParse({ id: data.get('id'), collection: data.get('collection') });
    if (!parsed.success) return fail(400, { action: 'deactivateAccount', error: 'Invalid request.' });
    try {
      await locals.pb.collection(parsed.data.collection).update(parsed.data.id, { isActive: false });
    } catch {
      return fail(500, { action: 'deactivateAccount', error: 'Something went wrong. Please try again.' });
    }
    return { success: true, action: 'deactivateAccount' };
  },

  reactivateAccount: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = toggleSchema.safeParse({ id: data.get('id'), collection: data.get('collection') });
    if (!parsed.success) return fail(400, { action: 'reactivateAccount', error: 'Invalid request.' });
    try {
      await locals.pb.collection(parsed.data.collection).update(parsed.data.id, { isActive: true });
    } catch {
      return fail(500, { action: 'reactivateAccount', error: 'Something went wrong. Please try again.' });
    }
    return { success: true, action: 'reactivateAccount' };
  }
};
