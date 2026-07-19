/**
 * Public live-share page (P5 C5) — works in any plain browser, no auth.
 * Trusted contacts never authenticate; only this function (service role)
 * reads the session. Dead simple by design: no websockets, no map SDK.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface ShareState {
  ok: boolean;
  name?: string;
  lat?: number;
  lng?: number;
  recorded_at?: string;
  distance_km?: number | null;
  elapsed_s?: number | null;
}

async function loadState(token: string): Promise<ShareState> {
  if (!token || token.length > 64) return { ok: false };
  const { data: session } = await supabase
    .from('live_share_sessions')
    .select('id, user_id, ended_at, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!session || session.ended_at != null || new Date(session.expires_at) <= new Date()) {
    return { ok: false };
  }
  const [{ data: profile }, { data: location }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', session.user_id).maybeSingle(),
    supabase.from('live_locations').select('*').eq('session_id', session.id).maybeSingle(),
  ]);
  if (!location) {
    return { ok: true, name: profile?.display_name ?? 'A runner' };
  }
  return {
    ok: true,
    name: profile?.display_name ?? 'A runner',
    lat: location.lat,
    lng: location.lng,
    recorded_at: location.recorded_at,
    distance_km: location.distance_km,
    elapsed_s: location.elapsed_s,
  };
}

function endedPage(status: number): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Run Everywhere</title>
<style>body{margin:0;background:#0B0B0C;color:#fff;font-family:system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
p{color:#8E8E96}</style></head>
<body><div><h1>This live share has ended.</h1><p>Run Everywhere</p></div></body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function livePage(token: string, state: ShareState): Response {
  const name = state.name ?? 'A runner';
  const lat = state.lat ?? 0;
  const lng = state.lng ?? 0;
  const hasFix = state.lat != null;
  const bbox = `${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}`;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — live</title>
<style>
body{margin:0;background:#0B0B0C;color:#fff;font-family:system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px}
.live{display:inline-flex;align-items:center;gap:8px;color:#00C271;font-weight:700;
letter-spacing:.08em;font-size:13px}
.dot{width:10px;height:10px;border-radius:50%;background:#00C271;animation:pulse 1.4s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
h1{margin:8px 0 4px;font-size:32px;text-transform:uppercase}
.stats{display:flex;gap:32px;margin:20px 0}
.stat b{display:block;font-size:34px;font-variant-numeric:tabular-nums}
.stat span{color:#8E8E96;font-size:12px;letter-spacing:.08em}
iframe{width:100%;height:340px;border:0;border-radius:12px;background:#18181B}
.meta{color:#8E8E96;font-size:13px;margin:12px 0}
a.maps{color:#CCFF00;font-weight:700;text-decoration:none;letter-spacing:.04em}
</style></head>
<body><main>
<span class="live"><span class="dot"></span>LIVE</span>
<h1 id="name">${name}</h1>
<div class="stats">
  <div class="stat"><b id="km">${state.distance_km ?? '—'}</b><span>KM</span></div>
  <div class="stat"><b id="time">${state.elapsed_s != null ? Math.floor(state.elapsed_s / 60) + ':' + String(state.elapsed_s % 60).padStart(2, '0') : '—'}</b><span>ELAPSED</span></div>
</div>
<div class="meta" id="updated">${hasFix ? 'Live position below' : 'Waiting for the first GPS fix…'}</div>
${hasFix ? `<iframe id="map" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lng}"></iframe>
<p><a class="maps" id="mapslink" href="https://maps.google.com/?q=${lat},${lng}">OPEN IN GOOGLE MAPS</a></p>` : ''}
<script>
const token=${JSON.stringify(token)};
async function poll(){
  try{
    const res=await fetch('?format=json&token='+encodeURIComponent(token),{cache:'no-store'});
    const s=await res.json();
    if(!s.ok){document.body.innerHTML='<main style="text-align:center;padding-top:30vh"><h1>This live share has ended.</h1></main>';return;}
    if(s.distance_km!=null)document.getElementById('km').textContent=s.distance_km;
    if(s.elapsed_s!=null)document.getElementById('time').textContent=Math.floor(s.elapsed_s/60)+':'+String(s.elapsed_s%60).padStart(2,'0');
    if(s.lat!=null){
      const ago=Math.max(0,Math.round((Date.now()-new Date(s.recorded_at).getTime())/1000));
      document.getElementById('updated').textContent='Last update '+ago+'s ago';
      const map=document.getElementById('map');
      const bbox=(s.lng-0.005)+','+(s.lat-0.003)+','+(s.lng+0.005)+','+(s.lat+0.003);
      const src='https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&marker='+s.lat+','+s.lng;
      if(map&&map.dataset.pos!==s.lat+','+s.lng){map.src=src;map.dataset.pos=s.lat+','+s.lng;}
      const link=document.getElementById('mapslink');
      if(link)link.href='https://maps.google.com/?q='+s.lat+','+s.lng;
    }
    setTimeout(poll,15000);
  }catch(e){setTimeout(poll,15000);}
}
setTimeout(poll,15000);
</script>
</main></body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const state = await loadState(token);

  if (url.searchParams.get('format') === 'json') {
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  if (!state.ok) return endedPage(404);
  return livePage(token, state);
});
