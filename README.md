# Weyvo — Your travel magazine

A social travel magazine: turn trips into magazine-style stories, post short stories (weekends, one-night stays, long drives), and build a personal travel map.

| Folder | What it is |
| --- | --- |
| `web/` | React + Vite + TypeScript frontend |
| `api/` | Spring Boot 3 (Java 21) REST API, Spring Security, JPA, Flyway |
| `docker-compose.yml` | Local Postgres for development |

## Run locally

Requirements: Node 20+, Java 21, Maven, Docker (OrbStack or Docker Desktop).

```bash
docker compose up -d                 # Postgres on localhost:5432
cd api && mvn spring-boot:run        # API on http://localhost:8080
cd web && npm install && npm run dev # Web on http://localhost:5173
```

If your default `java` is older than 21, prefix Maven commands with
`JAVA_HOME=$(/usr/libexec/java_home -v 21)` or set it in your shell profile.

## Tests

```bash
cd api && mvn test
```

Integration tests start a throwaway Postgres with Testcontainers. With OrbStack, point it at OrbStack's socket:
`export DOCKER_HOST=unix://$HOME/.orbstack/run/docker.sock`.

## API (so far)

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout` | Public |
| GET | `/api/auth/me` | Session cookie |
| GET | `/api/trips?kind=FULL\|SHORT` | Public feed (published + public only) |
| GET | `/api/trips/{slug}` | Signed out: first 60% of sections. Signed in: full. Private/draft: owner only |
| GET | `/api/users/{username}/trips` | Public trips of a user |
| GET | `/api/me/trips` | Your trips, including drafts |
| POST / PUT / DELETE | `/api/trips`, `/api/trips/{id}` | Owner only |
| POST | `/api/trips/{id}/publish` | Owner only |

## Configuration

Set these in every deployed environment (never commit real values):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | Postgres (Supabase) connection |
| `APP_JWT_SECRET` | Base64 key, 32+ random bytes, for signing session tokens |
| `APP_COOKIE_SECURE` | `true` behind HTTPS |
| `APP_CORS_ORIGINS` | Web app origin(s) allowed to call the API |
| `APP_STORAGE_PROVIDER` | `local` (default, files under `api/data/photos`) or `supabase` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Private Supabase Storage bucket for photos (server-side only) |

## Photos

Uploads are re-encoded on the server: format checked from the file bytes (JPEG/PNG), 40 MP cap checked before decoding,
EXIF orientation applied, then all metadata (GPS, camera, timestamps) dropped. Each photo is stored as a 2000px
version and a 600px thumbnail. Photos are only ever served through `GET /api/photos/{id}/{large|thumb}`, which applies
the same rules as the story: private and draft trips are owner-only, and signed-out readers can't load photos past the
60% preview.
