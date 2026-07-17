-- P2: pg_trgm search over title + area_name. SECURITY INVOKER — the runs
-- SELECT policy applies, so invite-only runs never surface here.
create index runs_area_name_trgm_idx
  on public.runs using gin (area_name extensions.gin_trgm_ops);

create function public.search_runs (
  p_query text,
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 30
)
returns table (run public.runs, distance_m double precision, approved_count bigint)
language sql security invoker set search_path = '' stable
as $$
  select
    r as run,
    extensions.st_distance (
      r.start_point,
      extensions.st_setsrid (extensions.st_makepoint (p_lng, p_lat), 4326)::extensions.geography
    ) as distance_m,
    (
      select count(*) from public.run_members m
      where m.run_id = r.id and m.status = 'approved'
    ) as approved_count
  from public.runs r
  where char_length(btrim(coalesce(p_query, ''))) >= 2
    and r.status = 'published'
    and r.visibility in ('open', 'approval')
    and r.starts_at >= now()
    and (r.title ilike '%' || btrim(p_query) || '%'
         or r.area_name ilike '%' || btrim(p_query) || '%')
  order by greatest(extensions.similarity (r.title, p_query),
                    extensions.similarity (r.area_name, p_query)) desc,
           distance_m asc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;
