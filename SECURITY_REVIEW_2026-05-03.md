# Security Review (May 3, 2026)

## Scope
- Authentication/session flow (`src/lib/auth`, `src/app/login/actions.ts`)
- Public file-serving APIs (`/api/files`, `/api/thumbnails`, `/api/download`)
- HTML rendering surfaces (`src/components/markdown.tsx`, `src/components/note-search-result.tsx`)
- Admin API authorization pattern (`src/lib/auth/verify-admin.ts` and `src/app/api/admin/*` handlers)

## Findings

### 1) Missing MIME-sniffing defense headers on binary responses (Medium)
**Status:** Fixed in this pass.

The file, thumbnail, and download endpoints did not send `X-Content-Type-Options: nosniff`.
Without this header, some user agents may attempt MIME sniffing on untrusted content, which can increase risk when serving user-controlled files.

**Fix implemented:** Added `X-Content-Type-Options: nosniff` on successful streaming responses from:
- `src/app/api/files/[filename]/route.ts`
- `src/app/api/thumbnails/[filename]/route.ts`
- `src/app/api/download/[filename]/route.ts`

### 2) In-memory login rate limiting can be bypassed across instances (Medium)
**Status:** Open.

`login()` uses a local in-memory limiter (`checkRateLimit`) keyed by client IP. In horizontally scaled deployments (multiple instances/containers), attackers can distribute attempts across nodes.

**Recommendation:** Move rate-limit state to shared storage (Redis/Postgres) and include account-specific + IP-based dimensions.

### 3) `SKIP_IP_HEADER_CHECK=1` weakens brute-force protection if exposed publicly (Medium)
**Status:** Open, configuration-sensitive.

When this environment flag is enabled, missing forwarding headers collapse to a single `direct` bucket, which weakens per-client distinction and may either over-throttle or under-protect in certain topologies.

**Recommendation:** Keep disabled for internet-exposed production; ensure reverse proxy sets `X-Forwarded-For`.

### 4) Session secret auto-generation improves startup but can surprise operators (Low)
**Status:** Open (acceptable tradeoff).

If `ADMIN_PASSWORD` is unset, a random password is generated and logged. This is safer than insecure defaults, but operationally fragile across restarts and can leak in logs if log sinks are broadly accessible.

**Recommendation:** Require explicit `ADMIN_PASSWORD` in production and treat startup logs as sensitive.

### 5) HTML sinks are sanitized appropriately (Info)
**Status:** Reviewed.

- Markdown rendering sanitizes with DOMPurify.
- Note search headline HTML allows only `<mark>` tags.

No immediate XSS issue identified in these reviewed paths.

## Additional hardening recommendations
- Add security response headers centrally (CSP, Referrer-Policy, Frame-Options) where applicable.
- Consider CSRF tokens for state-changing endpoints even with `SameSite=Lax` cookies.
- Add structured audit logs for auth failures and admin actions with anomaly detection.
- Add dependency scanning/SCA in CI and regular `npm audit` triage.

