# Weyvo: how it's built

A plain-words map of the stack, the code and how the pieces talk. Keep it current when something big changes.
See also [ROADMAP.md](ROADMAP.md) (what's next) and [DEPLOY.md](DEPLOY.md) (how to ship).

## The stack

| Layer | What we use | Notes |
| --- | --- | --- |
| Web app | React 18 + TypeScript, Vite, React Router | Phone-first; installable (PWA); no UI kit, own CSS tokens |
| API | Spring Boot 3.5 on Java 21 | One service, REST + Server-Sent Events |
| Database | Postgres on Supabase (Singapore, session pooler) | Schema in Flyway migrations `V1…` |
| Photos | Supabase Storage, private bucket | Resized and stripped of location data on upload; served through the API |
| Email | Resend | 6-digit codes for sign-up and password reset |
| Payments | Razorpay (test mode) | Premium; amounts set on the server, signatures checked |
| Errors | Sentry (web + API) | Personal data scrubbed (no slugs, query strings, IPs) |
| Push notifications | Web Push, implemented in the JDK (RFC 8291, VAPID) | Keys in the `push_keys` table |
| Hosting | Render: static site (web) + Docker web service (API, free plan) | The web forwards `/api/*` to the API; free API sleeps after 15 idle minutes |
| Companion | BubDub's Atlas (`~/Developer/trip-planner`) | Separate app, embedded in the Plan tab |
| AI | None, by rule | Content checks are plain word and pattern rules |

## Repository layout

```
web/                 React app
  src/pages/         one file per screen (Discover, Story, Create, Profile, Chat, Admin…)
  src/components/    shared pieces (BottomNav, Comments, QnA, Talk, WeyPoints…)
  src/api.ts         every API call and its types; retries, offline cache
  src/auth.tsx       signed-in user; remembered on the device
  src/useApi.ts      stale-while-revalidate cache (localStorage, 150 KB cap)
  public/sw.js       service worker: offline shell, photo cache, push
api/                 Spring Boot
  auth/              sign-up, login, email codes, session cookie (JWT), rate limits
  trip/              stories: create, edit, publish, 60% preview gate, short-story expiry
  photo/             upload, resize, storage (local disk in dev, Supabase in prod)
  social/            follows, reactions, comments, questions, notifications, blocks
  moderation/        ContentFilter: word/pattern rules that hold posts for review
  admin/             stats, users, report queue, strikes, suspend
  points/            Wey points (worked out from activity; spending recorded on orders)
  billing/ plan/     Premium and plan limits
  push/              web push
  chat/              private chat (see below)
  resources/db/migration/   Flyway SQL, applied automatically on start
docs/                these notes, roadmap, deploy guide
render.yaml          Render blueprint, security headers, /api rewrite
```

## How a request flows

1. The phone calls `/api/...` on the web's own address. Render forwards it to the API, so the session cookie
   stays first-party.
2. `JwtCookieFilter` reads the httpOnly `weyvo_session` cookie, checks the session version, account status and
   verified email, and records "last seen".
3. The controller calls a service; services use JPA for stories and plain SQL (`NamedParameterJdbcTemplate`) for
   the rest.
4. Errors come back as `{ error, fields }` with plain messages; the web shows them inline.

## Rules that shape the data

- **Short stories** are deleted 7 days after posting (`trips.expires_at`, `ShortStoryExpiry` every 15 minutes).
  Expired ones are hidden at once, even before the cleanup runs. Points earned from them stay.
- **Full issues** are kept until the author deletes them.
- **Word filter** (`ContentFilter`): sexual, abusive, political or selling text (links, phone numbers, "DM for
  price") holds a story, comment or question for admin review; three removals suspend an account.
- **Future trip dates** are refused.
- **Usernames** can change once every 90 days.

## Private chat

Snapchat-style one-to-one chat. Signed-in, verified accounts only.

- **Requests**: only your **followers** can send you a chat request (the sender must follow you). 10 new requests a day; after a
  decline, 30 days before asking that person again. Up to 100 open chats per person. Blocking ends a chat.
- **Vanishing**: a read message stays while either person has the chat open; once both have left it's deleted.
  A read message is also deleted 2 hours after it was read, and an unread one after 12 hours.
- **Limits**: text and emoji only, 500 characters, 1 message a second and 60 a minute, 30 unread waiting in one
  chat and 300 across all of a person's chats.
- **Checks**: links, phone numbers, abusive and sexual words are refused (any topic is fine).
- **Reports** save the last 20 messages for the admin (Admin → Reports → Reported chats); admins can't read chats otherwise.
- **Screens**: `/chat` (requests + chats, no message text), `/chat/:id` (conversation, ⓘ rules, ⋯ report/block/end), chat button on profiles.
- **Code**: `api/.../chat/` (`ChatService`, `ChatHub`, `ChatFilter`, `ChatController`), migration `V20__private_chat.sql`; `web/src/pages/Chat.tsx`, `ChatThread.tsx`, `components/MessageButton.tsx`.
- **Tech**:
  - Sending is a normal request. The message waits in Postgres (`chat_messages`) until it's read.
  - Delivery is live over **Server-Sent Events**: one stream per signed-in user while the Chat tab is open.
    It carries new messages, "seen", vanished messages and new requests.
  - If a proxy holds the stream back (no "hello" within 4 s), an open chat checks a tiny in-memory change counter
    (`/pulse`): every 2 s while busy (a message or typing in the last minute), 8 s when quiet, 15 s while the
    stream works. The messages are only reloaded when the counter changes. The chats list checks every 10–30 s.
  - Who has which chat open is kept in server memory, from the screen's own signals: "here" every 15 s while the
    chat is visible, "left" (sendBeacon) on back, app switch or lock; no signal for 35 s counts as left. The stream
    is never used for this, because proxies keep dead streams looking alive. A cleanup job runs every 5 minutes.
  - A web push says "New message" (never the text) when the app is closed.

## Testing

- API: `mvn test` (JUnit + Testcontainers Postgres; needs Docker, OrbStack locally).
- Web: `npx tsc --noEmit` and `npm run build`; screens checked in the browser preview at phone size.

## Ideas for later

- **Chat**: typing indicator, emoji reactions on messages, group chats for a trip, WebSockets if traffic grows.
  A second API instance would need shared presence (Redis or Postgres LISTEN/NOTIFY).
- **Promotions tab** for travel businesses (gear, stays, packages), later paid through Razorpay.
- **Photo screening** (would need an AI service; against the current rule).
- Enforce the Content-Security-Policy (now report-only); weekly database backup; Play Store package.
- Keep-awake pinger (cron-job.org) so the free API doesn't sleep; Razorpay webhook live; own domain.
- PostHog analytics with a cookie notice, once user testing starts.
