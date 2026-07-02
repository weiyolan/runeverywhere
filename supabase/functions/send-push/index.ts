// send-push — Phase 3 Edge Function stub.
//
// Pipeline: `notifications` INSERT → pg_net trigger → this function →
// Expo Push API (https://exp.host/--/api/v2/push/send), then receipt checks
// prune DeviceNotRegistered tokens. See docs/PLAN.md §Push pipeline.

Deno.serve(async (req) => {
  const payload = await req.json().catch(() => null);

  // Phase 3: look up push_tokens for payload.record.user_id, chunk messages
  // to the Expo Push API, store tickets for receipt checking.
  console.log('send-push stub received:', JSON.stringify(payload));

  return new Response(JSON.stringify({ ok: true, sent: 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
