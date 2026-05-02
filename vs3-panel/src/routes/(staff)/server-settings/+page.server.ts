import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const saveDeadlineConfigSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  hour: z.coerce.number().int().min(0).max(23),
  minute: z.coerce.number().int().min(0).max(59),
  is_active: z.preprocess(v => v === 'on' || v === 'true' || v === true, z.boolean())
});

const EXPORT_COLLECTIONS = [
  'factions',
  'nodes',
  'wars',
  'battles',
  'sieges',
  'diplomacy',
  'server_log',
  'node_ownership_history',
  'faction_members'
] as const;

export const load: PageServerLoad = async ({ locals }) => {
  const role = (locals.pb.authStore.record as { role?: string } | null)?.role;
  const isHeadAdmin = role === 'head_admin';

  const deadlineConfigList = await locals.pb
    .collection('deadline_config')
    .getList(1, 1, {})
    .catch(() => ({ items: [] as Array<Record<string, unknown>> }));
  const deadlineConfig = deadlineConfigList.items[0] ?? null;

  return { isHeadAdmin, deadlineConfig };
};

export const actions: Actions = {
  exportData: async ({ locals }) => {
    // Intentionally available to all staff (not head_admin only) — exportData is read-only.
    // A compromised staff account can export data but cannot mutate it via this endpoint.
    // If export access should be restricted, add a role check matching importData.
    try {
      const pbUrl = 'http://localhost:8090';
      const token = locals.pb.authStore.token;

      const res = await fetch(`${pbUrl}/api/vs3/export`, {
        headers: { Authorization: token }
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('[server-settings] Export endpoint error:', res.status, body);
        return fail(500, { action: 'exportData', error: 'Export failed. PocketBase returned an error.' });
      }

      const data: unknown = await res.json();
      return { success: true, action: 'exportData', exportJson: JSON.stringify(data) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[server-settings] exportData error:', message);
      return fail(500, { action: 'exportData', error: 'Export failed. Please try again.' });
    }
  },

  saveDeadlineConfig: async ({ request, locals }) => {
    const role = (locals.pb.authStore.record as { role?: string } | null)?.role;
    if (role !== 'head_admin') {
      return fail(403, { action: 'saveDeadlineConfig',
        errors: { _global: ['Deadline configuration requires Head Admin access.'] } });
    }
    const formData = await request.formData();
    const parsed = saveDeadlineConfigSchema.safeParse({
      day_of_week: formData.get('day_of_week'),
      hour: formData.get('hour'),
      minute: formData.get('minute'),
      is_active: formData.get('is_active')
    });
    if (!parsed.success) {
      return fail(400, { action: 'saveDeadlineConfig',
        errors: parsed.error.flatten().fieldErrors,
        values: Object.fromEntries(formData) });
    }
    try {
      const existing = await locals.pb.collection('deadline_config').getList(1, 1, {});
      const saveData = { ...parsed.data, timezone_offset: -5 };
      if (existing.items.length > 0) {
        await locals.pb.collection('deadline_config').update(existing.items[0].id, saveData);
      } else {
        await locals.pb.collection('deadline_config').create(saveData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return fail(500, { action: 'saveDeadlineConfig',
        errors: { _global: [`Save failed: ${message}`] } });
    }
    return { success: true, action: 'saveDeadlineConfig' };
  },

  importData: async ({ request, locals }) => {
    // Head Admin only
    const role = (locals.pb.authStore.record as Record<string, unknown>)?.role;
    if (role !== 'head_admin') {
      return fail(403, { action: 'importData', error: 'Data import requires Head Admin access.' });
    }

    const formData = await request.formData();
    const file = formData.get('backup');

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { action: 'importData', error: 'No backup file provided.' });
    }

    let backup: Record<string, unknown>;
    try {
      const text = await file.text();
      backup = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return fail(400, { action: 'importData', error: 'Invalid JSON file. Could not parse the backup.' });
    }

    // Validate top-level keys
    const requiredKeys: readonly string[] = EXPORT_COLLECTIONS;
    const missingKeys = requiredKeys.filter(k => !(k in backup));
    if (missingKeys.length > 0) {
      return fail(400, {
        action: 'importData',
        error: `Backup file is missing required keys: ${missingKeys.join(', ')}.`
      });
    }

    // Destructive import: delete all records then re-create from backup.
    // Fail fast on any collection error — report the exact collection name so staff
    // know what partial state exists. Each collection is attempted independently.
    for (const collection of EXPORT_COLLECTIONS) {
      // Delete phase — abort immediately on error (no silent partial state)
      try {
        const existing = await locals.pb.collection(collection).getFullList({ fields: 'id' });
        for (const r of existing) {
          await locals.pb.collection(collection).delete(r.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[server-settings] importData delete failed on '${collection}':`, message);
        return fail(500, {
          action: 'importData',
          error: `Import aborted: failed to clear collection '${collection}'. Subsequent collections were not modified. Error: ${message}`
        });
      }

      // Insert phase — abort on error with collection context
      const records = backup[collection];
      if (Array.isArray(records)) {
        for (const record of records) {
          const { id, created, updated, collectionId, collectionName, ...fields } = record as Record<string, unknown>;
          try {
            await locals.pb.collection(collection).create({ id, ...fields });
          } catch {
            // If ID conflict or not allowed, create without preserved ID
            try {
              await locals.pb.collection(collection).create(fields);
            } catch (err2: unknown) {
              const message2 = err2 instanceof Error ? err2.message : 'Unknown error';
              return fail(500, {
                action: 'importData',
                error: `Import aborted: failed to insert record into '${collection}'. Error: ${message2}`
              });
            }
          }
        }
      }
    }

    return { success: true, action: 'importData' };
  }
};
