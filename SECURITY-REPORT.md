# TicketWise Security Assessment Report

**Date:** 2026-02-06
**Target:** https://ticketwise.ingeniotech.co.uk
**Assessor:** Stavros (AI Security Review)

---

## Executive Summary

Overall security posture is **GOOD** for an internal tool, but there are several findings that should be addressed, particularly around postMessage origin validation.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 1 |
| 🟡 Medium | 3 |
| 🔵 Low | 4 |
| ℹ️ Info | 3 |

---

## Findings

### 🟠 HIGH: PostMessage Origin Not Validated

**Location:** `src/hooks/use-hosted-api.ts`

**Issue:** The postMessage event handler accepts messages from ANY origin without validation:
```javascript
window.addEventListener("message", handleMessage);
// No event.origin check in handleMessage
```

And messages are sent to wildcard origin:
```javascript
window.parent.postMessage(payload, "*");
```

**Risk:** A malicious page could potentially:
1. Send fake authentication data to the pod
2. Intercept sensitive data being sent via postMessage

**Recommendation:** Validate that `event.origin` matches expected ConnectWise domains:
```javascript
const ALLOWED_ORIGINS = [
  'https://eu.myconnectwise.net',
  'https://na.myconnectwise.net',
  'https://au.myconnectwise.net',
];

if (!ALLOWED_ORIGINS.includes(event.origin)) {
  return; // Ignore messages from unknown origins
}
```

---

### 🟡 MEDIUM: Missing Security Headers

**Issue:** Several recommended security headers are not present:

| Header | Status | Recommendation |
|--------|--------|----------------|
| `X-Content-Type-Options` | ❌ Missing | Add `nosniff` |
| `X-XSS-Protection` | ❌ Missing | Add `1; mode=block` (legacy browsers) |
| `Strict-Transport-Security` | ❌ Missing | Add HSTS header |
| `Referrer-Policy` | ❌ Missing | Add `strict-origin-when-cross-origin` |
| `Permissions-Policy` | ❌ Missing | Restrict unnecessary browser features |

**Note:** `X-Frame-Options` is intentionally omitted to allow iframe embedding, which is correct. `Content-Security-Policy: frame-ancestors *` is present.

---

### 🟡 MEDIUM: TLS 1.0/1.1 Enabled (Cloudflare)

**Issue:** The server accepts TLS 1.0 and TLS 1.1 connections, which are deprecated and have known vulnerabilities.

**Finding from nmap:**
```
TLSv1.0: enabled
TLSv1.1: enabled
```

**Recommendation:** Configure Cloudflare to require minimum TLS 1.2:
- Cloudflare Dashboard → SSL/TLS → Edge Certificates → Minimum TLS Version → TLS 1.2

---

### 🟡 MEDIUM: No Rate Limiting

**Issue:** No rate limiting implemented on the application. While Cloudflare provides some DDoS protection, the application itself has no request throttling.

**Risk:** 
- API abuse
- Potential for high OpenAI costs from excessive requests
- Brute force attempts

**Recommendation:** Implement rate limiting middleware, e.g., using `next-rate-limit` or similar.

---

### 🔵 LOW: Cookie Security - SameSite=None

**Location:** `src/actions/auth.ts`

**Issue:** Cookies are set with `sameSite: "none"` which is required for cross-site iframe usage but increases CSRF exposure.

```javascript
const cookieOptions = {
  sameSite: "none" as const,
  secure: true,
  httpOnly: true,  // Good!
};
```

**Mitigation:** The `httpOnly: true` and `secure: true` flags are correctly set, which mitigates most risks. The `SameSite=None` is necessary for the pod to work in the CW iframe.

---

### 🔵 LOW: No CSRF Protection

**Issue:** No CSRF tokens implemented. Server actions could potentially be invoked cross-origin.

**Mitigation:** Since this is a pod that only functions within ConnectWise (standalone access is blocked), and cookies require the CW context to be set, the risk is reduced. However, adding CSRF tokens would be defense-in-depth.

---

### 🔵 LOW: Technology Stack Disclosure

**Issue:** The 404 page reveals Next.js framework usage through React hydration code in the HTML.

**Risk:** Minimal - attackers could identify the framework, but this is low-value information.

---

### 🔵 LOW: API Key Permissions Too Broad

**Issue:** As discussed, the ConnectWise API key has read access to more areas than needed.

**Recommendation:** Create a dedicated API member with minimal permissions:
- Service Tickets: Read
- Configurations: Read
- (No access to: Companies, Contacts, Finance, Projects, etc.)

---

### ℹ️ INFO: Standalone Access Blocked (Good!)

The application correctly detects standalone access (not in iframe) and blocks usage:
```javascript
if (isStandalone) {
  return <"Pod Mode Only" message>
}
```

---

### ℹ️ INFO: No Sensitive Data in JS Bundles

Scanned all JavaScript bundles for API keys, secrets, tokens - none found. Environment variables are correctly server-side only.

---

### ℹ️ INFO: Health Endpoint Minimal Disclosure

The `/api/health` endpoint returns minimal, non-sensitive information:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T15:54:34.503Z",
  "service": "ticketwise"
}
```

---

## Recommendations Priority

1. **Immediate:** Implement postMessage origin validation
2. **Short-term:** Add security headers via middleware
3. **Short-term:** Set Cloudflare minimum TLS to 1.2
4. **Medium-term:** Implement rate limiting
5. **Medium-term:** Create restricted CW API member
6. **Nice-to-have:** Add CSRF tokens

---

## Tests Performed

- ✅ Security header analysis
- ✅ Nmap port scan + TLS cipher enumeration
- ✅ Directory enumeration
- ✅ Nikto web vulnerability scan
- ✅ XSS injection testing
- ✅ API input validation testing
- ✅ Source code review for secrets
- ✅ JavaScript bundle analysis
- ✅ Authentication flow review
- ✅ PostMessage security review

---

## Tools Used

- `curl` - HTTP request testing
- `nmap` - Port scanning and TLS analysis
- `nikto` - Web vulnerability scanner
- `grep` - Source code analysis
- Manual code review

---

*Report generated by automated security assessment*
