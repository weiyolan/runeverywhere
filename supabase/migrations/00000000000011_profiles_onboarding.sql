-- 1) Keep profiles.updated_at honest (clients cannot write it — see grants).
create function public.touch_updated_at ()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at ();

-- 2) Column-level write protection, superseding P0's 00000000000003 grant:
--    points_total / level / rating_avg / rating_count / created_at / updated_at
--    are server-maintained caches (PLAN.md §2 — client never writes points or
--    rating aggregates). P0's grant list included updated_at; now that the
--    touch trigger owns it, the revoke + re-grant is repeated without it.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, avatar_url, home_city, home_point,
              pace_band, distance_band, languages, units, visibility,
              tos_accepted_at, onboarded_at)
  on public.profiles to authenticated;

-- 3) Home location writer: validates coordinates, sets city + geography point
--    atomically. SECURITY INVOKER — RLS (own row) and the column grants above
--    still apply.
create function public.set_home_location (
  p_lat double precision,
  p_lng double precision,
  p_city text
) returns public.profiles
language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.profiles;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'invalid coordinates';
  end if;
  if p_city is null or btrim(p_city) = '' or char_length(btrim(p_city)) > 40 then
    raise exception 'invalid city';
  end if;

  update public.profiles
  set home_city = btrim(p_city),
      home_point = extensions.st_setsrid (
        extensions.st_makepoint (p_lng, p_lat), 4326)::extensions.geography
  where id = (select auth.uid ())
  returning * into v_row;

  if v_row is null then
    raise exception 'not authenticated';
  end if;
  return v_row;
end; $$;
