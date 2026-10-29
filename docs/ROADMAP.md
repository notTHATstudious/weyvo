# Weyvo roadmap

Decisions so far and the order of work to a tested public launch. Update this file as items land.

## Decided

| Area | Decision |
| --- | --- |
| Name | Weyvo |
| Look | A's colours, B's fonts (Bricolage Grotesque + Inter), A's magazine layout, dark viewer for Short Stories, dark theme in Settings |
| Stack | React + Vite, Spring Boot 3 (Java 21), Postgres |
| Database + photo storage | Supabase (private bucket; service key server-side only) |
| Email / OTP | Resend: 6-digit email code at sign-up and for password reset. No OTP on every login, no SMS |
| Payments | Razorpay (test mode first) for Premium |
| Monitoring | Sentry (errors), PostHog (product analytics, with consent) |
| Preview gate | Signed-out readers get the first 60% of a public story, enforced by the API |
| Plans | Free and Premium limits from configuration (`app.plans.*`); low values while testing |
| Short stories lifetime | Kept permanently on the profile, map and destination pages. Feeds favour the last 7 days, older ones fall back to search and profiles. No auto-delete |
| Not in Phase One | DMs, photo import, SMS OTP, itinerary integration, print |

## Milestones

Each milestone ends with: all tests green, a security pass against the checklist below, browser check, commit, push.

1. ✅ **Ask the traveller**: questions and answers on stories; author hides; anyone reports; limits per hour.
2. ✅ **In-app notifications**: follows, reactions, questions, answers; unread count; mark as read.
3. ✅ **Email with Resend**: verify email with a 6-digit code (10 min expiry, 5 tries, resend cooldown, hashed);
   unverified accounts can read but not post, react or follow; forgot / reset password (signs out other devices);
   login, sign-up and reset rate limits. Later: weekly digest. Before deploy: trust the proxy's client-IP header safely.
4. **Premium with Razorpay**: upgrade page, checkout, server-side signature check, webhook for renewals and
   cancellations, `plan_expires_at`; receipts by email.
5. ✅ **Edit and manage**: edit story screen, delete story, account settings, delete account (with data export).
6. **Short stories feed rules**: feed window (7 days), pagination everywhere, indexes checked with `EXPLAIN`.
7. **Legal and compliance** (see below) and footer.
8. **Supabase + deploy** to free hosting; Sentry and PostHog wired; seed a few real stories.
   ⏰ Reminder: Supabase is added only at this step, together with the Render deploy (database + photo
   bucket + keys in Render's environment). Local development keeps using Docker Postgres until then.
9. **User testing**: you test with real people, report back; fix list.
10. **Final security review** (full checklist), raise plan limits, launch.

## Security checklist (run after every milestone, in full before launch)

- Authorisation on every endpoint: owner checks, private/draft trips 404, no IDs that leak existence
- Input limits on every field server-side; uploads checked by bytes; no user HTML rendered
- Rate limits: sign-up, login, OTP send/verify, password reset, follows, reactions, questions, uploads
- Sessions: httpOnly, Secure, SameSite cookies; logout clears; secret rotated per environment
- CORS allowlist; security headers (CSP, HSTS, X-Content-Type-Options, frame-ancestors)
- Secrets only in environment variables; nothing in Git or the web bundle
- Logs without emails, passwords, tokens or OTPs
- Payments: amounts decided on the server; signature and webhook verified; idempotent
- Dependencies scanned (`npm audit`, OWASP dependency check); database backup and restore tested

## Legal and compliance (India first)

Not legal advice; have the final texts reviewed before a public launch.

- Terms of Use, Privacy Policy, Community Guidelines, Cookie notice (PostHog needs consent)
- Refund and Cancellation Policy, Contact Us page: required by Razorpay for live activation
- DPDP Act 2023: clear consent and purpose, account and data deletion, grievance contact, breach handling,
  minimum age 18 at launch (under-18s need verifiable parental consent)
- IT Rules 2021: published rules for users, grievance officer contact, acknowledge complaints and act on takedowns
- Copyright: users own their content and grant Weyvo a licence to display it; takedown request form
- Footer: © Weyvo, links to all of the above, support email

## Needed from you

- A domain (for example weyvo.in or weyvo.co): Resend needs a verified domain to email anyone but you,
  and one domain for web + API keeps the login cookie working
- Resend account and API key (after adding the domain's DNS records)
- Supabase project (region Mumbai, `ap-south-1`): database password, project URL, service role key
- Razorpay test key id, key secret, webhook secret: in your local `.env`, never in chat or Git
- Sentry and PostHog accounts (free tiers)
- Hosting accounts: Render (API) and Vercel or Cloudflare Pages (web)
- For legal pages: the business or owner name, support email, grievance officer name and email, city

## Hosting notes (free tiers)

- Render free web services sleep after inactivity, so the first request after a pause takes about a minute; fine for testing
- Serve the web app and API on the same domain (for example the web host forwards `/api` to Render), so the
  session cookie stays first-party
