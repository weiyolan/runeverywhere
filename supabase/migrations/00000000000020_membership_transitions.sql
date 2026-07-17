-- P2: membership transitions missing from 0001 (PLAN.md §2 state machine:
-- pending|approved → cancelled (runner); approved → removed (host)),
-- plus a definer capacity count so non-members can render "spots left"
-- (run_members SELECT policy hides rows from non-members by design).

-- Runner cancels own pending request or approved spot.
create function public.cancel_join (p_run_id uuid)
returns public.run_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_row public.run_members;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.status <> 'published' then
    raise exception 'run is not open';
  end if;

  update public.run_members
  set status = 'cancelled', decided_at = now(), decided_by = v_uid
  where run_id = p_run_id and user_id = v_uid
    and status in ('pending', 'approved')
  returning * into v_row;

  if v_row is null then raise exception 'no active request or membership'; end if;
  return v_row;
end;
$$;

-- Host removes an approved member. Removed members cannot rejoin
-- (join_run's ON CONFLICT clause only revives cancelled/declined rows).
create function public.remove_member (p_run_id uuid, p_user_id uuid)
returns public.run_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_row public.run_members;
begin
  -- Mandatory: without this, an anon caller (auth.uid() IS NULL) slips past
  -- the host check below — `host_id <> null` is NULL, plpgsql treats it as
  -- false — and the definer UPDATE would run. See rls review notes.
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.host_id <> v_uid then
    raise exception 'only the host can remove members';
  end if;

  update public.run_members
  set status = 'removed', decided_at = now(), decided_by = v_uid
  where run_id = p_run_id and user_id = p_user_id and status = 'approved'
  returning * into v_row;

  if v_row is null then raise exception 'no approved member to remove'; end if;
  return v_row;
end;
$$;

-- Definer count: exposes only an integer, never member rows. Backs the
-- run-detail "spots left" for viewers who cannot read run_members.
create function public.run_approved_count (p_run_id uuid)
returns integer
language sql security definer set search_path = '' stable
as $$
  select count(*)::integer from public.run_members
  where run_id = p_run_id and status = 'approved';
$$;

-- Hardening: 0001's respond_to_join_request shipped WITHOUT the
-- not-authenticated guard. Supabase grants EXECUTE on public functions to
-- anon by default, and with auth.uid() NULL its only auth check
-- (`host_id <> v_uid`) evaluates to NULL → false in plpgsql, so an anon
-- caller could decide pending requests. Re-create with the guard; body
-- otherwise identical to 0001.
create or replace function public.respond_to_join_request (
  p_run_id uuid,
  p_user_id uuid,
  p_approve boolean
)
returns public.run_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.runs;
  v_uid uuid := (select auth.uid ());
  v_approved_count integer;
  v_row public.run_members;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.host_id <> v_uid then
    raise exception 'only the host can decide requests';
  end if;

  if p_approve then
    select count(*) into v_approved_count
    from public.run_members
    where run_id = p_run_id and status = 'approved';
    if v_approved_count + 1 >= v_run.max_group then
      raise exception 'run is full';
    end if;
  end if;

  update public.run_members
  set status = case when p_approve then 'approved' else 'declined' end::public.member_status,
      decided_at = now(),
      decided_by = v_uid
  where run_id = p_run_id and user_id = p_user_id and status = 'pending'
  returning * into v_row;

  if v_row is null then
    raise exception 'no pending request for that runner';
  end if;
  return v_row;
end;
$$;
