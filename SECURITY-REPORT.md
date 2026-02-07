# TicketWise Security Assessment Report

**Date:** 2026-02-06 (Updated: 2026-02-07)
**Target:** https://ticketwise.ingeniotech.co.uk
**Assessor:** Stavros (AI Security Review)

---

## Executive Summary

Overall security posture is **GOOD**. All high and medium priority findings have been remediated.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 ✅ (was 1) |
| 🟡 Medium | 0 ✅ (was 3) |
| 🔵 Low | 4 |
| ℹ️ Info | 3 |

---

## Resolved Findings

### ✅ RESOLVED: PostMessage Origin Validation

**Status:** FIXED (2026-02-07)

Origin validation implemented in `src/hooks/use-hosted-api.ts`:
```javascript
const ALLOWED_ORIGINS = [
  "https://eu.myconnectwise.net",
  "https://na.myconnectwise.net",
  "https://au.myconnectwise.net",
  "https://staging.connectwisedev.com",
];
```

---

### ✅ RESOLVED: Security Headers

**Status:** FIXED

All security headers implemented in `src/middleware.ts`:

| Header | Status |
|--------|--------|
| `X-Content-Type-Options: nosniff` | ✅ |
| `X-XSS-Protection: 1; mode=block` | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | ✅ |
| `Content-Security-Policy: frame-ancestors *` | ✅ |
| HSTS | ✅ (Cloudflare) |

---

### ✅ RESOLVED: TLS 1.0/1.1 (Cloudflare)

**Status:** FIXED (2026-02-07)

Minimum TLS version set to 1.2 across all Cloudflare zones.

---

### ✅ RESOLVED: Rate Limiting

**Status:** IMPLEMENTED

Rate limiting: 30 requests per minute per member.

---

## Remaining Low Priority Findings

### 🔵 LOW: Cookie Security - SameSite=None

Cookies use `sameSite: "none"` which is required for cross-site iframe usage. Mitigated by `httpOnly: true` and `secure: true`.

---

### 🔵 LOW: No CSRF Protection

No CSRF tokens implemented. Low risk since standalone access is blocked and cookies require CW context.

---

### 🔵 LOW: Technology Stack Disclosure

404 page reveals Next.js framework. Minimal risk.

---

### 🔵 LOW: API Key Permissions Too Broad

**Recommendation:** Create a dedicated API member with minimal permissions (Service Tickets: Read, Configurations: Read).

---

## Cloudflare Security (Updated 2026-02-07)

Applied to ingeniotech.co.uk:

- ✅ Minimum TLS 1.2
- ✅ HSTS enabled (6 months, includeSubDomains)
- ✅ Always Use HTTPS
- ✅ SSL Mode: Full
- ⏳ Bot Fight Mode (dashboard only)
- ⏳ DNSSEC (requires registrar update)

---

## Summary

All HIGH and MEDIUM findings have been resolved. Remaining items are low priority hardening measures.

---

*Last updated: 2026-02-07 by Stavros*
