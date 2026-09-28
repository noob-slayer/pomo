-- Welcome email for new sign-ups. Sends once, the first time a real (non-guest) account is
-- created -- i.e. someone's first Google sign-in. Anonymous guests have no email and are
-- skipped.
--
-- SETUP (do these in the Supabase dashboard before running this file):
--   1. Resend: create a free account at resend.com, then Domains -> add pomo.site and add
--      the DNS records it shows to your domain (SPF/DKIM). Wait until it says "Verified".
--      (To test before the domain verifies, you can only send to your OWN Resend account
--      email, and must use from = 'onboarding@resend.dev' -- see the note on `mail_from` below.)
--   2. Resend: API Keys -> create one (starts with "re_"). Copy it.
--   3. Supabase SQL editor: store the key + sender in Vault so it isn't hard-coded here:
--        select vault.create_secret('re_xxxxxxxxxxxx', 'RESEND_API_KEY');
--        select vault.create_secret('pomo <hello@pomo.site>', 'WELCOME_MAIL_FROM');
--      (use 'onboarding@resend.dev' as the from-address value until pomo.site is verified)
--   4. Database -> Extensions: enable `pg_net` (or it's enabled by the first line below).
--   5. Run THIS file.
--
-- SAFETY: the trigger is wrapped so ANY failure (missing key, Resend down, bad response)
-- is swallowed and the user row still commits -- a broken welcome email can never block a
-- sign-in. pg_net's http_post is also async (it queues the request and returns immediately),
-- so it never holds up the transaction.

create extension if not exists pg_net;

create or replace function public.send_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  resend_key text;
  mail_from text;
  display_name text;
  html_body text;
begin
  -- only real, emailed sign-ups -- never anonymous guests
  if new.email is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;

  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;
  select decrypted_secret into mail_from from vault.decrypted_secrets where name = 'WELCOME_MAIL_FROM' limit 1;
  if resend_key is null or mail_from is null then
    return new; -- not configured yet -- do nothing, never error
  end if;

  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    'there'
  );

  html_body :=
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#211a17">'
    || '<div style="background:#8a234e;color:#fff;padding:28px 24px;border-radius:14px 14px 0 0">'
    || '<h1 style="margin:0;font-size:24px">welcome to pomo 🍅</h1>'
    || '<p style="margin:8px 0 0;opacity:.9">hey ' || replace(display_name, '<', '') || ', glad you''re here.</p>'
    || '</div>'
    || '<div style="background:#efeae6;padding:22px 24px;border-radius:0 0 14px 14px">'
    || '<p style="margin:0 0 14px;line-height:1.6">pomo is a focus timer built to make you actually want to open it again tomorrow. a few things to try:</p>'
    || '<ul style="margin:0 0 18px;padding-left:18px;line-height:1.7">'
    || '<li><b>co-working lobbies</b> — focus alongside friends and see who''s in a session live</li>'
    || '<li><b>stats &amp; streaks</b> — a heatmap, badges and a focus score that build over time</li>'
    || '<li><b>make it fun</b> — colour themes, photo/video backgrounds, a lofi cafe and more</li>'
    || '</ul>'
    || '<a href="https://pomo.site" style="display:inline-block;background:#8a234e;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:600">start a focus session →</a>'
    || '<p style="margin:18px 0 0;font-size:12px;color:#9a8f89">you''re getting this because you signed in to pomo.site. that''s the only email we''ll send unless you ask.</p>'
    || '</div></div>';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', mail_from,
      'to', new.email,
      'subject', 'welcome to pomo 🍅',
      'html', html_body
    )
  );

  return new;
exception
  when others then
    -- never let a welcome-email problem roll back the user's creation / sign-in
    return new;
end;
$$;

drop trigger if exists on_new_user_welcome_email on auth.users;
create trigger on_new_user_welcome_email
  after insert on auth.users
  for each row
  execute function public.send_welcome_email();

-- ---------------------------------------------------------------------------------------
-- TEST (after setup, without needing a brand-new Google account): send yourself one now.
-- Replace the address with your own, run it, check your inbox, then check the result:
--   select net.http_post(
--     url := 'https://api.resend.com/emails',
--     headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='RESEND_API_KEY'),'Content-Type','application/json'),
--     body := jsonb_build_object('from',(select decrypted_secret from vault.decrypted_secrets where name='WELCOME_MAIL_FROM'),'to','you@example.com','subject','pomo test','html','<p>it works</p>')
--   );
-- pg_net logs responses here (look for status 200 and an id):
--   select id, status_code, content from net._http_response order by id desc limit 5;
-- ---------------------------------------------------------------------------------------
