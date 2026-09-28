-- run this once in your Supabase project's SQL editor (dashboard -> SQL Editor -> New
-- query -> paste -> Run), BEFORE deploying the client change that marks the realtime
-- channels `private: true`.
--
-- Tier 3 fix from the security review: the realtime layer (chat, presence, kudos, timer
-- sync, and self-sync across your own devices) used *public* channels. Supabase realtime
-- public channels have NO authorization -- anyone who knows a channel name can subscribe
-- and publish. Channel names are derived from the lobby id (shared with members) and, for
-- self-sync, from auth.uid() (which fellow members can read via get_lobby_members). So a
-- lobby member could listen to another member's private timer across their devices, push
-- forged timer state to their devices, or (in a sync lobby) broadcast fake start/stop to
-- everyone.
--
-- The fix: mark those channels `private: true` on the client (see src/lib/lobbySync.ts and
-- src/lib/selfSync.ts) and gate them with RLS on realtime.messages here. Applying THIS file
-- alone changes nothing about the currently-deployed app -- these policies only take effect
-- for channels that are actually private, and today's channels are public. So it's safe to
-- run now and deploy the client change after.
--
-- Scope check (auth.uid() is present for everyone, guests included -- see
-- supabase/lobby_identity_hardening.sql, which bootstraps an anonymous session for guests):
--   * pomo-lobby-{sync,chat,kudos,presence}-<lobbyId>  -> allowed only for members of <lobbyId>
--   * pomo-self-<uid>                                  -> allowed only for that same uid
--
-- Both SELECT (subscribe / receive) and INSERT (broadcast + presence writes) go through
-- realtime.messages, so both need a policy. The `authenticated` role covers anonymous
-- guests too (anonymous sign-in still authenticates, it just sets is_anonymous).

-- realtime.messages already has RLS enabled by Supabase; these are additive. Re-runnable.
drop policy if exists "pomo realtime read" on realtime.messages;
drop policy if exists "pomo realtime write" on realtime.messages;

create policy "pomo realtime read"
on realtime.messages
for select
to authenticated
using (
  -- your own self-sync channel
  realtime.topic() = 'pomo-self-' || auth.uid()::text
  -- or a lobby channel for a lobby you're a member of
  or exists (
    select 1
    from public.lobby_members m
    where m.identity_key = auth.uid()::text
      and realtime.topic() in (
        'pomo-lobby-sync-' || m.lobby_id::text,
        'pomo-lobby-chat-' || m.lobby_id::text,
        'pomo-lobby-kudos-' || m.lobby_id::text,
        'pomo-lobby-presence-' || m.lobby_id::text
      )
  )
);

create policy "pomo realtime write"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() = 'pomo-self-' || auth.uid()::text
  or exists (
    select 1
    from public.lobby_members m
    where m.identity_key = auth.uid()::text
      and realtime.topic() in (
        'pomo-lobby-sync-' || m.lobby_id::text,
        'pomo-lobby-chat-' || m.lobby_id::text,
        'pomo-lobby-kudos-' || m.lobby_id::text,
        'pomo-lobby-presence-' || m.lobby_id::text
      )
  )
);
