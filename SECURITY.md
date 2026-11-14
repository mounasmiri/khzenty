# Security

Khzenty is a portfolio project, but it is built the way a real service would be. This
page says what is protected, how, and where the limits are.

## Reporting a problem

Open a private security advisory on the GitHub repository (Security → Report a
vulnerability), or contact the maintainer directly. Please do not file a public issue for
anything exploitable.

## What is protected

| Area | Protection |
| --- | --- |
| **Passwords** | Argon2id (19 MiB, 2 iterations — OWASP baseline), hashed with explicit parameters. Login does a dummy verify when the email is unknown, so timing does not reveal registered accounts. One generic `Invalid email or password` message. |
| **Brute force** | Per-IP rate limits: login 10 / 15 min, sign-up 5 / hour, destination search 60 / min. `429` in the normal error shape. Health is deliberately unlimited. |
| **Sessions** | Signed JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) with a 7-day expiry. The user is re-read from the database on every request, so a deleted account stops working at once. |
| **CSRF** | `SameSite=Lax`; JSON-only body parsing (no form parser, so a cross-site `<form>` cannot reach a handler); and an `Origin` check that refuses any state-changing request declaring an origin other than `CLIENT_ORIGIN`. |
| **CORS** | One exact origin from `CLIENT_ORIGIN`. A wildcard is rejected at boot. |
| **Headers** | `helmet` defaults; `x-powered-by` disabled; 100 KiB JSON body limit (`413` beyond). |
| **Secrets** | Nothing secret is committed (history scanned; only `.env.example` files are tracked, `.env*` is ignored). `JWT_SECRET` is required, ≥ 32 characters, and in production a placeholder or repetitive value, or a non-`https` `CLIENT_ORIGIN`, stops the server booting. |
| **Input** | Every body is validated with Zod. Every `:id` / `:entryId` route parameter is checked against a strict id pattern (router-wide, so a new route cannot forget). The one query string (destination search) is Zod-validated. |
| **Data access** | Every query on user data includes the caller's `userId` in the `WHERE` (not read-then-compare). Another user's resource is a `404`, never a `403`, so ids cannot be probed. Entries attached to trips and outfits are checked for ownership too. |
| **Uploads** | Image bytes never reach the API: direct browser → Cloudinary with a short-lived signature that covers `folder` and `allowed_formats`. The server re-reads the real format and byte count from Cloudinary before recording anything, deletes violators, and only accepts a `publicId` inside the caller's own folder. No client-controlled storage keys. |
| **Errors and logs** | Unexpected errors return `Internal Server Error` with no message or stack (a stack is added only when `NODE_ENV=development`). Malformed JSON is a `400`, not a `500`. In production, Prisma errors are logged as name and code only, because their messages embed query arguments. 404s do not echo the requested path. |
| **Third-party calls** | Weather and geocoding are made by the server only, with parameters built through `URLSearchParams` (encoded), a 4–5 s timeout, and graceful degradation. The browser never contacts them. |
| **Health** | `GET /api/health` runs `SELECT 1`; `503 {"status":"degraded"}` when the database is unreachable. In production the body is only `{"status": "ok" | "degraded"}`. |
| **Demo sandbox** | `POST /api/auth/demo` is off unless `DEMO_LOGIN_ENABLED=true` (otherwise an ordinary 404). It takes no input: it clones the fixed template account `demo@khzenty.test` into a **new, private `isDemo` user** (random `.test` address, an unusable password hash, so it can never be signed into by password) and issues the normal cookie session. Visitors never share data, and the template is never signed into. Demo copies cannot upload (`403` on the signature and attach endpoints), and **can never destroy a Cloudinary asset** — they borrow the template's images by reference, so deletion and replacement skip destruction for demo users, and an asset still referenced by any other row is never destroyed for anyone. Copies are deleted (cascading) after 24 h, on every demo sign-in and at server boot; at most `DEMO_MAX_USERS` exist, then `503`. Same rate limit as login. |
| **Client** | No `dangerouslySetInnerHTML`, `innerHTML` or `eval`. The only browser storage is a non-sensitive consent flag. No tokens in `localStorage`. |
| **Supply chain** | CI runs `npm audit --omit=dev --audit-level=high` on both packages; Dependabot proposes npm and GitHub Actions updates weekly. |

## Known limits

These are real, understood, and not fixed:

1. **Sign-out does not revoke the token.** Sessions are stateless JWTs. Logout clears the
   cookie in the browser, but a token someone already copied stays valid until it expires
   (7 days). Fixing it needs server-side state — for example a `sessionVersion` column on
   `User` that logout increments (which also signs the user out of every device). This
   is a product decision, so it is left open.
2. **Rate limits are in memory and per process.** With several API instances each keeps
   its own counter, so the effective limit is multiplied. A shared store (Redis) would fix
   that. Limits are keyed by IP, so many users behind one NAT share a budget. Set
   `TRUST_PROXY` to the true number of proxy hops in production, or every client appears
   to share the proxy's address.
3. **No account lockout, no email verification, no password reset, no MFA.** Out of scope
   for the MVP.
4. **Cross-origin deployment.** `SameSite=Lax` assumes the API and web app are the same
   site. Hosting them on different sites needs `SameSite=None; Secure` and a fresh look at
   CSRF (the origin check stays valid and becomes the main defence).
5. **Client dependency advisory.** `@imgly/background-removal` (background removal, which
   this project's AGPL licence is built around) pins `zod@3`, flagged as
   GHSA-mrhx-c7xc-m3w5 (memory exhaustion validating oversized collections). npm's only
   offered fix is a breaking downgrade of that library. The code runs in the user's own
   browser on its own configuration, not on untrusted input, so the practical risk is low.
   The client audit step in CI is therefore non-blocking until the library updates.
6. **Third-party images.** Garment photos are served from Cloudinary URLs; their privacy
   is whatever the Cloudinary delivery settings allow (public by URL).
7. **Demo sandbox limits.** Visitors are anonymous and can create garments, outfits and trips in their copy for 24 hours. That is bounded by the per-IP rate limit on sign-in, the live-copy cap, the body size limit and the 24 h expiry, but there is no per-copy row quota. The cap check is not atomic, so a burst can briefly exceed `DEMO_MAX_USERS` by a few. Many visitors behind one NAT share the sign-in budget. Cleanup is opportunistic (on demo sign-in and at boot), so with no traffic expired copies wait for the next one.
8. **Request logging.** Access logs (`morgan`, production) include URL paths and query
   strings, which for destination search contain the city typed.

## Operating notes

- Generate a fresh `JWT_SECRET` per environment:
  `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`
- Run behind HTTPS and set `NODE_ENV=production`, `CLIENT_ORIGIN=https://…` and
  `TRUST_PROXY` to match the deployment.
- Rotating `JWT_SECRET` signs everyone out.
