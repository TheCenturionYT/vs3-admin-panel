import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const addManualEntrySchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  related_faction: z.string().optional(),
  related_node: z.string().optional()
});

const editLogEntrySchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, 'Description is required.'),
  related_faction: z.string().optional(),
  related_node: z.string().optional()
});

const deleteLogEntrySchema = z.object({
  id: z.string().min(1)
});

export const load: PageServerLoad = async ({ locals }) => {
  const [logRecords, factions, nodes] = await Promise.all([
    locals.pb.collection('server_log').getList(1, 200, {
      sort: '-created',
      expand: 'related_faction,related_node'
    }),
    locals.pb.collection('factions').getFullList({
      sort: 'name',
      fields: 'id,name'
    }),
    locals.pb.collection('nodes').getFullList({
      sort: 'name',
      fields: 'id,name'
    })
  ]);

  return {
    logEntries: logRecords.items.map(r => ({
      id: r.id as string,
      created: r.created as string,
      event_type: r.event_type as string,
      description: r.description as string,
      actor: r.actor as string,
      related_faction: r.related_faction as string | null,
      related_faction_name: (r.expand?.related_faction?.name as string) ?? null,
      related_node: r.related_node as string | null,
      related_node_name: (r.expand?.related_node?.name as string) ?? null
    })),
    factions: factions.map(f => ({
      id: f.id as string,
      name: f.name as string
    })),
    nodes: nodes.map(n => ({
      id: n.id as string,
      name: n.name as string
    }))
  };
};

export const actions: Actions = {
  addManualEntry: async ({ request, locals }) => {
    const data = await request.formData();
    const parsed = addManualEntrySchema.safeParse({
      description: data.get('description'),
      related_faction: data.get('related_faction') || undefined,
      related_node: data.get('related_node') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        action: 'addManualEntry',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(data)
      });
    }

    const actor = (locals.pb.authStore.record?.username as string) ?? 'Staff';

    try {
      await locals.pb.collection('server_log').create({
        event_type: 'manual_entry',
        description: parsed.data.description,
        actor,
        related_faction: parsed.data.related_faction ?? null,
        related_node: parsed.data.related_node ?? null
      });
    } catch {
      return fail(500, {
        action: 'addManualEntry',
        errors: { _global: ['Something went wrong. Please try again.'] },
        values: Object.fromEntries(data)
      });
    }

    return { success: true, action: 'addManualEntry' };
  },

  editLogEntry: async ({ request, locals }) => {
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, { action: 'editLogEntry', errors: { _global: ['Head Admin access required.'] } });
    }
    const data = await request.formData();
    const parsed = editLogEntrySchema.safeParse({
      id: data.get('id'),
      description: data.get('description'),
      related_faction: data.get('related_faction') || undefined,
      related_node: data.get('related_node') || undefined
    });
    if (!parsed.success) {
      return fail(400, { action: 'editLogEntry', errors: parsed.error.flatten().fieldErrors });
    }
    try {
      await locals.pb.collection('server_log').update(parsed.data.id, {
        description: parsed.data.description,
        related_faction: parsed.data.related_faction ?? null,
        related_node: parsed.data.related_node ?? null
      });
    } catch {
      return fail(500, { action: 'editLogEntry', errors: { _global: ['Failed to update entry.'] } });
    }
    return { success: true, action: 'editLogEntry' };
  },

  deleteLogEntry: async ({ request, locals }) => {
    if (locals.pb.authStore.record?.role !== 'head_admin') {
      return fail(403, { action: 'deleteLogEntry', errors: { _global: ['Head Admin access required.'] } });
    }
    const data = await request.formData();
    const parsed = deleteLogEntrySchema.safeParse({ id: data.get('id') });
    if (!parsed.success) {
      return fail(400, { action: 'deleteLogEntry', errors: { _global: ['Invalid request.'] } });
    }
    try {
      await locals.pb.collection('server_log').delete(parsed.data.id);
    } catch {
      return fail(500, { action: 'deleteLogEntry', errors: { _global: ['Failed to delete entry.'] } });
    }
    return { success: true, action: 'deleteLogEntry' };
  }
};
