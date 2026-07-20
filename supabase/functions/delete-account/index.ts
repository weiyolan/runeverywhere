/**
 * Account deletion (P5 F8, PLAN.md §2 tier 2). Storage cleanup first, auth
 * delete last (retryable — a rerun completes). DB rows go with the auth
 * user's cascade; reports survive with nulled FKs by FK design.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
const serviceClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const BUCKETS = ['avatars', 'tracks'];

async function removePrefix(bucket: string, uid: string) {
  const { data: objects } = await serviceClient.storage.from(bucket).list(uid, { limit: 1000 });
  if (objects?.length) {
    await serviceClient.storage
      .from(bucket)
      .remove(objects.map((o) => `${uid}/${o.name}`));
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405 });
  }
  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad request' }), { status: 400 });
  }
  if (body.confirm !== 'DELETE') {
    return new Response(JSON.stringify({ ok: false, error: 'confirmation required' }), {
      status: 400,
    });
  }

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: userRes, error: userError } = await anonClient.auth.getUser(jwt);
  if (userError || !userRes.user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
  const uid = userRes.user.id;

  for (const bucket of BUCKETS) {
    try {
      await removePrefix(bucket, uid);
    } catch (e) {
      console.error(`storage cleanup failed for ${bucket}:`, e);
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(uid);
  if (deleteError) {
    return new Response(JSON.stringify({ ok: false, error: deleteError.message }), {
      status: 500,
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
