-- P2: invite codes travel as a URL path segment (runeverywhere://invite/<code>
-- in H2/I4; P7's https bounce page). 0001's default is standard base64, whose
-- alphabet includes '+' and '/' — a '/' lands in ~31% of 12-char codes
-- (1 − (62/64)^12) and splits the invite/[code] route segment. Swap new codes
-- to the URL-safe alphabet and translate existing rows in place ('-' and '_'
-- never occur in standard base64, so the swap is collision-free and the
-- unique constraint holds).
alter table public.runs
  alter column invite_code
  set default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');

update public.runs
set invite_code = translate(invite_code, '+/', '-_')
where invite_code ~ '[+/]';
