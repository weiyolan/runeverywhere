-- P0 hardening: points_reward is always server-computed. The previous
-- trigger fired only on distance_km/type updates, letting a direct
-- UPDATE set points_reward. Recompute on every write instead.
drop trigger if exists runs_points_reward on public.runs;
create trigger runs_points_reward
  before insert or update on public.runs
  for each row execute function public.set_run_points_reward ();
