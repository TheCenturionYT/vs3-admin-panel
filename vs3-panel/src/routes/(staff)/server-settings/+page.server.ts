import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
  return {
    isHeadAdmin: (locals.pb.authStore.record as Record<string, unknown>)?.role === 'head_admin'
  };
};

export const actions: Actions = {
  exportData: async ({ locals }) => {
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

    // Destructive import: delete all records then create from backup
    try {
      for (const collection of EXPORT_COLLECTIONS) {
        // Delete all existing records
        const existing = await locals.pb.collection(collection).getFullList({ fields: 'id' });
        await Promise.all(existing.map(r => locals.pb.collection(collection).delete(r.id)));

        // Create records from backup
        const records = backup[collection];
        if (Array.isArray(records)) {
          for (const record of records) {
            const { id, created, updated, collectionId, collectionName, ...fields } = record as Record<string, unknown>;
            // Preserve original ID if possible (PocketBase allows id on create)
            try {
              await locals.pb.collection(collection).create({ id, ...fields });
            } catch {
              // If ID conflict or not allowed, create without ID
              await locals.pb.collection(collection).create(fields);
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[server-settings] importData error:', message);
      return fail(500, { action: 'importData', error: `Import failed: ${message}` });
    }

    return { success: true, action: 'importData' };
  }
};
