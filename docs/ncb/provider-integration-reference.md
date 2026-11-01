# NoCodeBackend Integration Prompts

**IMPORTANT: Save the three artifacts below as `auth_proxy_setup.md`, `data_proxy_setup.md`, and `setup_account.md`. Copy the code exactly.**

## 🛠 Recommended Next Tools
- **setup_auth_providers**: Configure which auth methods are enabled (MANDATORY before building auth UI).
- **setup_r2_storage**: If the app has file or image uploads, call this tool to create a dedicated R2 bucket and configure CORS (auto-reuses existing Cloudflare account if available).
- **install_account_component**: Automatically bundled below. It is a required customer-app deliverable: install the package, create its local gateway, and render its trigger before declaring the integration complete.

- **get_monetization_status**: When the product has subscriptions or paid tiers, use it only to report availability and direct the owner to that database's Enable Billing (Beta) screen. Dashboard onboarding and plan management are the default.

# NoCodeBackend Auth Proxy Setup Guide

> **IMPORTANT:** Save this file as `auth_proxy_setup.md` in your project root.

## Overview

The auth proxy handles user authentication by proxying requests to NCB Auth API and managing session cookies.

**Key Points:**
- Session cookies are the only authentication mechanism needed
- NCB accepts cookies in BOTH formats:
  - `better-auth.session_token` (without prefix)
  - `__Secure-better-auth.session_token` (with prefix)
- NCB dynamically finds any cookie ending with `better-auth.session_token`

---

## Environment Variables

Create `.env.local` in the project root:

```env
NCB_INSTANCE=34968_mosaic_learning
NCB_AUTH_API_URL=https://app.nocodebackend.com/api/user-auth
NCB_DATA_API_URL=https://app.nocodebackend.com/api/data
NCB_APP_URL=https://app.nocodebackend.com
NCB_SECRET_KEY=<the server-only key returned by create_database>
```

**Rules:**
- Read values only from `process.env`
- Do NOT hardcode values
- Do NOT expose to client
- Do NOT use `NEXT_PUBLIC_*`
- `NCB_SECRET_KEY` is required by the Account gateway and must remain server-only

---

## Create Auth Proxy Route

Create the file at: `app/api/auth/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

const CONFIG = {
  instance: process.env.NCB_INSTANCE!,
  apiUrl: process.env.NCB_AUTH_API_URL!,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, path.join("/"));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  
  // Special handling for sign-out
  if (pathStr === "sign-out") {
    return handleSignOut(req);
  }
  
  return proxy(req, pathStr, await req.text());
}

/**
 * Extract only better-auth cookies from the request.
 * NCB accepts cookies as-is (with or without __Secure- prefix).
 */
function extractAuthCookies(cookieHeader: string): string {
  if (!cookieHeader) return "";
  
  const cookies = cookieHeader.split(";");
  const authCookies: string[] = [];
  
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith("better-auth.session_token=") || 
        trimmed.startsWith("better-auth.session_data=")) {
      authCookies.push(trimmed);
    }
  }
  
  return authCookies.join("; ");
}

/**
 * Transform Set-Cookie headers from NCB for localhost compatibility.
 * NCB sends cookies with __Secure- prefix which browsers reject on localhost.
 */
function transformSetCookieForLocalhost(cookie: string): string {
  const parts = cookie.split(";");
  const nameValue = parts[0].trim();
  
  // Strip __Secure- or __Host- prefix from cookie name
  let cleanedNameValue = nameValue;
  if (nameValue.startsWith("__Secure-better-auth.")) {
    cleanedNameValue = nameValue.replace("__Secure-", "");
  } else if (nameValue.startsWith("__Host-better-auth.")) {
    cleanedNameValue = nameValue.replace("__Host-", "");
  }
  
  // Filter out attributes that don't work on localhost
  const otherAttributes = parts.slice(1)
    .map(attr => attr.trim())
    .filter(attr => {
      const lower = attr.toLowerCase();
      return !lower.startsWith("domain=") && 
             !lower.startsWith("secure") &&
             !lower.startsWith("samesite=");
    });
  
  // Add SameSite=Lax for localhost
  otherAttributes.push("SameSite=Lax");
  
  return [cleanedNameValue, ...otherAttributes].join("; ");
}

// Sign-out handler that always returns 200 and clears cookies
async function handleSignOut(req: NextRequest) {
  const response = new NextResponse(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  // Try to call upstream sign-out
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("Instance", CONFIG.instance);
    const url = \`\${CONFIG.apiUrl}/sign-out?\${searchParams.toString()}\`;
    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const authCookies = extractAuthCookies(req.headers.get("cookie") || "");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Database-Instance": CONFIG.instance,
        "Cookie": authCookies,
        "Origin": origin,
      },
      body: "{}",
    });

    // Forward any Set-Cookie headers from upstream
    const cookies = res.headers.getSetCookie?.() || [];
    for (const cookie of cookies) {
      response.headers.append("Set-Cookie", transformSetCookieForLocalhost(cookie));
    }
  } catch {
    // Ignore upstream errors
  }

  // Always clear auth cookies
  const cookiesToClear = [
    "better-auth.session_token",
    "better-auth.session_data",
  ];
  
  for (const cookieName of cookiesToClear) {
    response.headers.append(
      "Set-Cookie",
      \`\${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax\`
    );
  }

  return response;
}

async function proxy(req: NextRequest, path: string, body?: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("Instance", CONFIG.instance);
  const url = \`\${CONFIG.apiUrl}/\${path}?\${searchParams.toString()}\`;
  const origin = req.headers.get("origin") || req.nextUrl.origin;

  const authCookies = extractAuthCookies(req.headers.get("cookie") || "");

  const res = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "X-Database-Instance": CONFIG.instance,
      "Cookie": authCookies,
      "Origin": origin,
    },
    body: body || undefined,
  });

  const data = await res.text();
  const response = new NextResponse(data, { 
    status: res.status, 
    headers: { "Content-Type": "application/json" } 
  });

  // Transform Set-Cookie headers for localhost compatibility
  const cookies = res.headers.getSetCookie?.() || [];
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", transformSetCookieForLocalhost(cookie));
  }
  
  return response;
}
```

---

## Cookie Handling

### When Receiving from NCB (Set-Cookie)

NCB sends cookies with `__Secure-` prefix. For localhost compatibility:
- Strip `__Secure-` and `__Host-` prefixes
- Strip `Domain` attribute
- Strip `Secure` flag
- Set `SameSite=Lax`

### When Forwarding to NCB

NCB accepts cookies in BOTH formats:
- `better-auth.session_token` (without prefix)
- `__Secure-better-auth.session_token` (with prefix)

Simply forward the cookies as stored in the browser.

---

## Auth Providers Endpoint (REQUIRED — CREATE FIRST)

**CRITICAL:** You MUST fetch available auth providers from the server and only render the enabled ones. NEVER hardcode auth buttons.

Create `app/api/auth-providers/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  const url = \`\${process.env.NCB_AUTH_API_URL}/providers?instance=\${process.env.NCB_INSTANCE}\`;
  const res = await fetch(url);
  const data = await res.json();
  return NextResponse.json(data);
}
```

### Response Format

```json
{
  "providers": {
    "email": true,
    "google": false,
    "emailOTP": false
  }
}
```

### Provider Types

| Provider Key | Auth Method | When `true` |
|-------------|-------------|-------------|
| `email` | Email + Password | Show email/password sign-in and sign-up forms |
| `google` | Google OAuth | Show "Sign in with Google" button |
| `emailOTP` | Email OTP (passwordless) | Show "Sign in with Email OTP" flow (email → 6-digit code) |

**IMPORTANT:** These are THREE separate and distinct providers. `email` (password-based) and `emailOTP` (passwordless code) are DIFFERENT — do NOT confuse them.

---

## Authentication Usage

### Session Retrieval

```typescript
const res = await fetch("/api/auth/get-session", {
  credentials: "include",
});
const session = await res.json();

if (session.user) {
  // User is logged in
} else {
  // User is logged out
}
```

### 1. Email + Password (provider key: `email`)

Only render if `providers.email === true`.

#### Sign In
```typescript
const res = await fetch("/api/auth/sign-in/email", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

#### Sign Up
```typescript
const res = await fetch("/api/auth/sign-up/email", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});
```

### 2. Google OAuth (provider key: `google`)

Only render if `providers.google === true`.

```typescript
window.location.href = \`/api/auth/sign-in/social?provider=google&callbackURL=\${encodeURIComponent(window.location.origin + "/auth/callback")}\`;
```

Create callback page at `app/auth/callback/page.tsx`:
```typescript
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return <div>Authenticating...</div>;
}
```

### 3. Email OTP — Passwordless (provider key: `emailOTP`)

Only render if `providers.emailOTP === true`. This is a 2-step flow — completely separate from email+password.

**Step 1 — Send OTP:**
```typescript
const res = await fetch("/api/auth/email-otp/send-verification-otp", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, type: "sign-in" }),
});
```

**Step 2 — Verify OTP:**
```typescript
const res = await fetch("/api/auth/sign-in/email-otp", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, otp }), // 6-digit code
});
```

**Notes:** `type: "sign-in"` auto-creates user if new. OTP is 6 digits, expires in 5 minutes. No password needed.

### Sign Out (all providers)

```typescript
await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
window.location.href = "/";
```

---

## Rendering Auth UI (MUST follow this pattern)

**CRITICAL:** Always fetch providers FIRST, then conditionally render ONLY the enabled auth methods.

```typescript
"use client";
import { useEffect, useState } from "react";

type Providers = { email?: boolean; google?: boolean; emailOTP?: boolean };

export default function AuthPage() {
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    fetch("/api/auth-providers")
      .then(res => res.json())
      .then(data => setProviders(data.providers || {}))
      .catch(() => setProviders({ email: true }));
  }, []);

  if (!providers) return <div>Loading...</div>;

  return (
    <div>
      {providers.google && <GoogleSignInButton />}
      {providers.emailOTP && <EmailOTPForm />}
      {providers.email && <EmailPasswordForm />}
    </div>
  );
}
```

**Rules:**
- NEVER show a Google button if `providers.google` is not `true`
- NEVER show an Email+Password form if `providers.email` is not `true`
- NEVER show an Email OTP form if `providers.emailOTP` is not `true`
- ALWAYS fetch from `/api/auth-providers` on page load — do NOT hardcode

---

## Completion Checklist

Auth proxy setup is complete when:
- [ ] `/api/auth-providers` endpoint created and returns provider list
- [ ] UI fetches providers on load and ONLY renders enabled auth methods
- [ ] Email+Password sign-in/sign-up works (if `email` enabled)
- [ ] Google OAuth redirect and callback works (if `google` enabled)
- [ ] Email OTP send + verify flow works (if `emailOTP` enabled)
- [ ] `/api/auth/get-session` returns user info
- [ ] Page refresh keeps user logged in
- [ ] Sign-out clears cookies and UI state

---

## 4. Auth Endpoints Cheat Sheet

Once your proxy is set up at `/api/auth/[...path]`, you can call these endpoints from your frontend components:

### Standard Email/Password
- **Sign Up:** `POST /api/auth/sign-up` (body: `{ email, password, name }`)
- **Sign In:** `POST /api/auth/sign-in/email` (body: `{ email, password }`)
- **Sign Out:** `POST /api/auth/sign-out`

### Passwordless (Email OTP)
- **Send OTP:** `POST /api/auth/email-otp/send-verification-otp` (body: `{ email, type: "sign-in" }`)
- **Verify OTP:** `POST /api/auth/sign-in/email-otp` (body: `{ email, otp }`)

### Social OAuth
- **Google Login:** `GET /api/auth/sign-in/google`
  *(Note: Social logins often require redirect handling. Make sure you set up an OAuth callback page.)*

### Config / Providers
- **Get Enabled Providers:** `GET /api/auth-providers` (Custom proxy route to fetch `{ email: true, google: false, ... }`)

---

## Next Step

Proceed to `data_proxy_setup.md` for CRUD operations.


# NoCodeBackend Data Proxy Setup Guide

> **IMPORTANT:** Save this file as `data_proxy_setup.md` in your project root.

## Overview

NCB provides **two data routes** for different access patterns:

1. **`/api/data/[...path]`** - Authenticated route. Requires session. Uses session-based RLS by default. For `shared_*` tables, skips user_id filtering so admins can see each other's data.
2. **`/api/public-data/[...path]`** - Public route. No session required. Only works for tables with a `public_*` policy in `ncba_rls_config`.

**Note:** NCB accepts cookies in both formats:
- `better-auth.session_token` (without prefix)
- `__Secure-better-auth.session_token` (with prefix)

NCB dynamically finds any cookie ending with `better-auth.session_token`.

---

## Environment Variables

```env
NCB_INSTANCE=34968_mosaic_learning
NCB_AUTH_API_URL=https://app.nocodebackend.com/api/user-auth
NCB_DATA_API_URL=https://app.nocodebackend.com/api/data
NCB_APP_URL=https://app.nocodebackend.com
```

---

## RLS Policy Types

### Shared Policies (authenticated route — cross-admin access)

| Policy | Auth Required | Read | Write | user_id Filter |
|--------|-------------|------|-------|----------------|
| *(not in config)* | Yes | Own only | Own only | `WHERE user_id = session_user` |
| `shared_read` | Yes | All admins' records | Own only | No filter for reads |
| `shared_readwrite` | Yes | All admins' records | All admins' records | No filter at all |

### Public Policies (public route — anonymous access)

| Policy | Public Read | Public Write | Scoped to Owner |
|--------|-----------|-------------|-----------------|
| *(not in config)* | No | No | N/A (Private) |
| `public_read` | Yes (all records) | No | No |
| `public_write` | No | Yes (no owner) | No |
| `public_readwrite` | Yes (all records) | Yes (no owner) | No |
| `public_scoped_read` | Yes (owner's records) | No | Yes (`owner_id` required) |
| `public_scoped_write` | No | Yes (assigned to owner) | Yes (`owner_id` required) |
| `public_scoped_readwrite` | Yes (owner's records) | Yes (assigned to owner) | Yes (`owner_id` required) |

**IMPORTANT:** These policies ONLY affect the public route. The authenticated route ALWAYS uses session-based RLS.

**Combining policies:** You can combine one `shared_*` + one `public_*` policy (stored comma-separated, e.g. `"shared_read,public_scoped_read"`). Within each group, pick only one.

### ⚡ Auto-Setting Policies (IMPORTANT for AI tools)

**You MUST set the correct RLS policy using the `set_rls_policy` MCP tool whenever the app requires non-private access.**

| App Requirement | Table Example | Policy to Set |
|----------------|---------------|---------------|
| Public blog / marketplace (anyone reads) | posts, products | `public_read` |
| Public booking page (scoped to one admin) | event_types | `public_scoped_read` |
| Public booking form (creates for an admin) | bookings | `public_scoped_write` |
| Public contact/feedback form | feedback, contact | `public_write` |
| Team dashboard (admins see all data) | any shared table | `shared_read` |
| Combined: team + public on same table | event_types | `shared_read,public_scoped_read` |
| Private (DEFAULT — no action needed) | any table | `private` |

Call `set_rls_policy` with: `{ database, table, policy }`. The policy MUST be set BEFORE the public route will serve data for that table.

---

## Authenticated Data Proxy (REQUIRED)

**Path:** `app/api/data/[...path]/route.ts`

This route is for **authenticated users** (admin panel, dashboard, etc.). Session is ALWAYS required.

**Behavior:**
- **Private tables** (default): Normal RLS — `WHERE user_id = session_user`
- **`shared_read` tables**: Reads return all admins' records. Writes still inject user_id from session.
- **`shared_readwrite` tables**: No user_id filter for any operation.
- **`public_*` tables**: Treated as private on the authenticated route (normal session RLS).

The **backend** handles all policy logic by reading `ncba_rls_config` itself — no custom headers needed from the proxy.

### Shared Utilities

Create `lib/ncb-utils.ts` with these helpers used by BOTH proxies:

```typescript
// lib/ncb-utils.ts
import { NextRequest, NextResponse } from "next/server";

export const CONFIG = {
  instance: process.env.NCB_INSTANCE!,
  dataApiUrl: process.env.NCB_DATA_API_URL!,
  authApiUrl: process.env.NCB_AUTH_API_URL!,
  appUrl: process.env.NCB_APP_URL || "https://app.nocodebackend.com",
};

export function extractAuthCookies(cookieHeader: string): string {
  if (!cookieHeader) return "";
  const cookies = cookieHeader.split(";");
  const authCookies: string[] = [];
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith("better-auth.session_token=") || 
        trimmed.startsWith("better-auth.session_data=")) {
      authCookies.push(trimmed);
    }
  }
  return authCookies.join("; ");
}

export async function getSessionUser(cookieHeader: string): Promise<{ id: string } | null> {
  const authCookies = extractAuthCookies(cookieHeader);
  if (!authCookies) return null;
  const url = \`\${CONFIG.authApiUrl}/get-session?instance=\${CONFIG.instance}\`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Database-Instance": CONFIG.instance,
      "Cookie": authCookies,
      "Authorization": `Bearer ${process.env.NCB_SECRET_KEY}`
    },
  });
  if (res.ok) {
    const data = await res.json();
    return data.user || null;
  }
  return null;
}

export async function proxyToNCB(
  req: NextRequest,
  path: string,
  body?: string,
) {
  const searchParams = new URLSearchParams();
  searchParams.set("instance", CONFIG.instance);
  req.nextUrl.searchParams.forEach((val, key) => {
    if (key.toLowerCase() !== "instance") searchParams.append(key, val);
  });
  const url = \`\${CONFIG.dataApiUrl}/\${path}?\${searchParams.toString()}\`;
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const cookieHeader = req.headers.get("cookie") || "";
  const authCookies = extractAuthCookies(cookieHeader);
  const res = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "X-Database-Instance": CONFIG.instance,
      "Cookie": authCookies,
      "Origin": origin,
      "Authorization": `Bearer ${process.env.NCB_SECRET_KEY}`
    },
    body: body || undefined,
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function proxyToNCBPublic(
  req: NextRequest,
  path: string,
  body?: string,
) {
  const searchParams = new URLSearchParams();
  searchParams.set("instance", CONFIG.instance);
  req.nextUrl.searchParams.forEach((val, key) => {
    if (key.toLowerCase() !== "instance") searchParams.append(key, val);
  });
  const url = \`\${CONFIG.dataApiUrl}/\${path}?\${searchParams.toString()}\`;
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const res = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "X-Database-Instance": CONFIG.instance,
      "Origin": origin,
      "Authorization": `Bearer ${process.env.NCB_SECRET_KEY}`
      // NO cookies forwarded — anonymous request
    },
    body: body || undefined,
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- RLS Policy Cache ---
type RlsPolicies = Record<string, string>;
let cachedPolicies: RlsPolicies | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getRlsPolicies(): Promise<RlsPolicies> {
  const now = Date.now();
  if (cachedPolicies && now < cacheExpiry) return cachedPolicies;
  try {
    const url = \`\${CONFIG.appUrl}/api/public/rls-policies?instance=\${CONFIG.instance}\`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      cachedPolicies = (data.policies || {}) as RlsPolicies;
      cacheExpiry = now + CACHE_TTL;
      return cachedPolicies;
    }
  } catch {}
  return cachedPolicies || {};
}

export function extractTableFromPath(pathStr: string): string {
  const segments = pathStr.split("/");
  return segments[1] || "";
}

/**
 * Parse a policy string (may be comma-separated for combined policies).
 * E.g. "shared_read,public_scoped_read" → ["shared_read", "public_scoped_read"]
 */
function parsePolicies(policy?: string): string[] {
  if (!policy) return [];
  return policy.split(",").map(p => p.trim()).filter(Boolean);
}

export function allowsPublicRead(policy?: string): boolean {
  const parts = parsePolicies(policy);
  return parts.some(p => ["public_read", "public_readwrite", "public_scoped_read", "public_scoped_readwrite"].includes(p));
}

export function allowsPublicWrite(policy?: string): boolean {
  const parts = parsePolicies(policy);
  return parts.some(p => ["public_write", "public_readwrite", "public_scoped_write", "public_scoped_readwrite"].includes(p));
}

export function requiresOwnerScope(policy?: string): boolean {
  const parts = parsePolicies(policy);
  return parts.some(p => ["public_scoped_read", "public_scoped_write", "public_scoped_readwrite"].includes(p));
}

// Note: isSharedRead/isSharedWrite removed — backend handles shared logic itself.
```

### Authenticated Proxy Code

```typescript
// app/api/data/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, proxyToNCB } from "@/lib/ncb-utils";

const UNAUTHORIZED = (msg = "Unauthorized") =>
  new NextResponse(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const user = await getSessionUser(req.headers.get("cookie") || "");
  if (!user) return UNAUTHORIZED();
  return proxyToNCB(req, path.join("/"));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const body = await req.text();
  const user = await getSessionUser(req.headers.get("cookie") || "");
  if (!user) return UNAUTHORIZED();

  if (pathStr.startsWith("create/") && body) {
    try {
      const parsed = JSON.parse(body);
      delete parsed.user_id;
      parsed.user_id = user.id;
      return proxyToNCB(req, pathStr, JSON.stringify(parsed));
    } catch {}
  }
  return proxyToNCB(req, pathStr, body);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const body = await req.text();
  const user = await getSessionUser(req.headers.get("cookie") || "");
  if (!user) return UNAUTHORIZED();

  if (body) {
    try {
      const parsed = JSON.parse(body);
      delete parsed.user_id;
      return proxyToNCB(req, pathStr, JSON.stringify(parsed));
    } catch {}
  }
  return proxyToNCB(req, pathStr, body);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const user = await getSessionUser(req.headers.get("cookie") || "");
  if (!user) return UNAUTHORIZED();
  return proxyToNCB(req, path.join("/"));
}
```

---

## Public Data Proxy (REQUIRED for apps with public pages)

**Path:** `app/api/public-data/[...path]/route.ts`

This route is for **anonymous/unauthenticated access** (public booking pages, storefronts, blogs, etc.). No session required. Only works for tables with a public policy configured in NCB.

```typescript
// app/api/public-data/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  proxyToNCBPublic,
  getRlsPolicies,
  extractTableFromPath,
  allowsPublicRead,
  allowsPublicWrite,
  requiresOwnerScope,
} from "@/lib/ncb-utils";

const json = (body: object, status = 200) =>
  new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const table = extractTableFromPath(pathStr);
  if (!table) return json({ error: "Invalid path" }, 400);

  const policies = await getRlsPolicies();
  const policy = policies[table];
  if (!allowsPublicRead(policy)) {
    return json({ error: "This table does not allow public read access" }, 403);
  }

  if (requiresOwnerScope(policy)) {
    const ownerId = req.nextUrl.searchParams.get("owner_id");
    if (!ownerId) return json({ error: "owner_id query parameter is required for this table" }, 400);
  }

  return proxyToNCBPublic(req, pathStr);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const table = extractTableFromPath(pathStr);
  const body = await req.text();
  if (!table) return json({ error: "Invalid path" }, 400);
  if (!pathStr.startsWith("create/")) {
    return json({ error: "Public route only allows create operations" }, 403);
  }

  const policies = await getRlsPolicies();
  const policy = policies[table];
  if (!allowsPublicWrite(policy)) {
    return json({ error: "This table does not allow public write access" }, 403);
  }

  if (requiresOwnerScope(policy) && body) {
    try {
      const parsed = JSON.parse(body);
      const ownerId = parsed.owner_id;
      if (!ownerId) return json({ error: "owner_id is required in the body for this table" }, 400);
      delete parsed.owner_id;
      delete parsed.user_id;
      parsed.user_id = ownerId;
      return proxyToNCBPublic(req, pathStr, JSON.stringify(parsed));
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
  }

  if (body) {
    try {
      const parsed = JSON.parse(body);
      delete parsed.user_id;
      delete parsed.owner_id;
      return proxyToNCBPublic(req, pathStr, JSON.stringify(parsed));
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
  }

  return proxyToNCBPublic(req, pathStr, body);
}

// Public route does NOT support PUT or DELETE for security.
```

---

## Frontend Usage

### Authenticated routes (admin panel / dashboard)

**Important Rules for NCB Data API:**
1. **Action Prefixes:** Unlike standard REST APIs, ALL routes must be prefixed with their action (`/read/`, `/create/`, `/update/`, `/delete/`).
2. **Single Item Fetching:** To fetch a single item, use `?id=1` instead of `/1`. (e.g., `/read/products?id=1`).
3. **Response Structure:** Queries always return JSON in the format: `{ status: "success", data: [...], metadata: {...} }`.

Always include `credentials: "include"` when calling the authenticated data proxy:

```typescript
// Read Multiple (RLS filters by session user)
const res = await fetch("/api/data/read/products", { credentials: "include" });
const { data, metadata } = await res.json();
console.log("Products:", data);

// Read Single (Use ?id=1, NOT /1)
const singleRes = await fetch("/api/data/read/products?id=123", { credentials: "include" });
const { data: [product] } = await singleRes.json();
console.log("Product:", product);

// Create (user_id injected from session)
const res = await fetch("/api/data/create/products", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "My Product", price: 9.99 }),
});

// Update (Requires /update/ prefix and the ID parameter)
const res = await fetch("/api/data/update/products/123", {
  method: "PUT",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Updated Title" }),
});

// Delete (Requires /delete/ prefix and the ID parameter)
const res = await fetch("/api/data/delete/products/123", {
  method: "DELETE",
  credentials: "include",
});
```

### Public routes (anonymous pages - no credentials needed)

```typescript
// PUBLIC READ (unscoped) - blog posts, marketplace
const res1 = await fetch("/api/public-data/read/posts");
const { data: posts } = await res1.json();

// PUBLIC READ (scoped) - booking page, storefront
const res2 = await fetch(\`/api/public-data/read/event_types?owner_id=\${adminUserId}\`);
const { data: eventTypes } = await res2.json();


// PUBLIC CREATE (unscoped) - feedback, waitlist
const res3 = await fetch("/api/public-data/create/feedback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Great!", email: "user@example.com" }),
});
const { status, summary, errors } = await res3.json();

// PUBLIC CREATE (scoped) - booking for a specific admin
const res4 = await fetch("/api/public-data/create/bookings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "John",
    email: "john@example.com",
    date: "2026-03-15",
    owner_id: adminUserId, // Required - assigns booking to this admin
  }),
});
const response = await res4.json();
```

---

## How RLS Works

### Authenticated Route (`/api/data/`)
1. Proxy validates session and gets user ID
2. Forwards session cookies to NCB
3. NCB applies `WHERE user_id = <session_user_id>`
4. Admin only sees their own records

### Public Route (`/api/public-data/`)
1. Proxy checks `ncba_rls_config` for the table's policy
2. If no public policy → 403
3. **Unscoped** policies: NCB serves all records (no `user_id` filter)
4. **Scoped** policies: NCB applies `WHERE user_id = <owner_id>` from the `owner_id` query parameter

**Admin isolation is NEVER broken.** The authenticated route always uses session RLS regardless of any policy.

---

## 3. Data API Endpoints Cheat Sheet

When making requests from your frontend to your `/api/data` proxy, use the following HTTP methods and URL paths. 
*(Note: Your AI agent must construct frontend `fetch` calls exactly like this!)*

- **Read/List Records:** `GET /api/data/read/YOUR_TABLE_NAME`
- **Get Single Record:** `GET /api/data/read/YOUR_TABLE_NAME?id=123`
- **Create Record:** `POST /api/data/create/YOUR_TABLE_NAME` (body: `{ column: "value" }`)
- **Update Record:** `POST /api/data/update/YOUR_TABLE_NAME?id=123` (body: `{ column: "new_value" }`)
- **Delete Record:** `POST /api/data/delete/YOUR_TABLE_NAME?id=123`

---

## 4. Handling File / Media Uploads (Cloudflare R2 Storage)

Does your application require file, image, avatar, document, or media uploads (or have columns of type `FILE`)?

- **If NO (no file uploads):** No Cloudflare R2 setup is needed. You can skip this section.
- **If YES (app requires file uploads):**

### Step A: Configure R2 Storage via `setup_r2_storage` Tool
Before uploading files, configure Cloudflare R2 storage for this database:
- **Auto-reuse**: Call `setup_r2_storage` with `{ "database": "34968_mosaic_learning" }`. If your NoCodeBackend account already has a Cloudflare R2 connection from any database, it will automatically reuse your credentials, create a brand-new dedicated bucket (`34968_mosaic_learning-storage`), and configure CORS policies.
- **First-time setup**: If no Cloudflare account has been connected yet, the tool will ask for your Cloudflare credentials (`account_id`, `access_key_id`, `secret_access_key`), or you can configure it via the NoCodeBackend Dashboard at `https://app.nocodebackend.com/r2-storage`.

### Step B: Uploading Files via MCP Tool (AI Agents)
During development, testing, or mock data generation, use the `upload_file` MCP tool to upload files directly to Cloudflare R2 storage or generate presigned upload URLs.

### Step C: Frontend Application Uploads
**How to upload files via proxy:**
1. Send a `POST /api/data/upload` request with `multipart/form-data`.
2. Ensure the file is appended under the key `"file"` (e.g. `formData.append("file", fileObj)`).
3. The server uploads it to Cloudflare R2 and returns: `{ success: true, url: "https://..." }`.
4. Take the returned `url` string and pass it when you create or update the record.

Example frontend upload logic:
```javascript
const formData = new FormData();
formData.append("file", fileObject);

const uploadRes = await fetch("/api/data/upload", {
  method: "POST",
  body: formData
});
const { url } = await uploadRes.json();

// Now save `url` in your record
await fetch("/api/data/create/your_table", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ file_column: url, ... })
});
```

---




# NoCodeBackend Account Component Setup

> **IMPORTANT:** Save this file as `setup_account.md` in your project root. This is a required integration artifact for every customer-facing app that uses NCB authentication.

The official Account component is a maintained, Clerk-style end-user experience. It includes Profile, password changes, active sessions, per-device and other-device sign-out, full sign-out, and a Billing tab that follows live monetization status. Do not substitute a hand-built profile menu unless the owner explicitly asks for a custom component.

## 1. Install

```bash
npm install @nocodebackend/account-react@latest
```

## 2. Server-only configuration

Ensure `.env.local` contains these values. `NCB_SECRET_KEY` is the key returned by `create_database`; never expose it through `NEXT_PUBLIC_*`.

```env
NCB_INSTANCE=34968_mosaic_learning
NCB_SECRET_KEY=<the database secret key from create_database>
NCB_APP_URL=https://app.nocodebackend.com
NCB_AUTH_API_URL=https://app.nocodebackend.com/api/user-auth
```

## 3. Create the secure local gateway

Create `app/api/ncb/account/[...path]/route.ts`:

```typescript
import { createNcbAccountProxy } from "@nocodebackend/account-react/next";

const proxy = createNcbAccountProxy({
  instance: process.env.NCB_INSTANCE!,
  secretKey: process.env.NCB_SECRET_KEY!,
  appUrl: process.env.NCB_APP_URL,
  authApiUrl: process.env.NCB_AUTH_API_URL,
});

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context) {
  return proxy(request, (await context.params).path);
}

export const GET = handle;
export const POST = handle;
```

## 4. Render the trigger once

Create a client component such as `components/AccountButton.tsx`:

```tsx
"use client";

import { NCBAccount } from "@nocodebackend/account-react";

export function AccountButton() {
  return <NCBAccount />;
}
```

Render `<AccountButton />` exactly once in the signed-in navbar, header, or app shell.

## 5. Required task list

- [ ] Install `@nocodebackend/account-react`.
- [ ] Add the server-only environment values above.
- [ ] Create `app/api/ncb/account/[...path]/route.ts` with `createNcbAccountProxy`.
- [ ] Render `<AccountButton />` exactly once for signed-in users.
- [ ] Call the MCP `create_test_user` tool and sign in locally with that account.
- [ ] Complete the smoke tests below before declaring integration complete.

## 6. Required smoke tests

1. Signed out: no Account trigger is visible.
2. Sign in with the test user created through MCP: the Account trigger appears.
3. Open Account: Profile and Security load successfully through `/api/ncb/account/*`.
4. Update the display name, reload the page, and confirm it persists.
5. Open Security, confirm the current device is listed, then verify Sign out logs out this browser and requires a fresh login.
6. In a second browser profile, sign in as the same test user. From the first browser select **Sign out other devices**, then refresh the second browser and confirm it is forced to log in again.
7. Confirm browser code contains no NCB secret, database name, `user_id`, or provider customer ID.
8. If monetization is off, Billing is absent. In NoCodeBackend, open this database's **Enable Billing (Beta)** screen from its actions menu, enable billing there, and confirm Billing appears without a page reload; disable it again and confirm the tab disappears.

**Completion gate:** do not report the app as integrated until all six tasks and eight smoke tests are complete. In the final report, list the gateway route, trigger component, and layout/navbar file that renders it.


## ⛔ Required Account Component

Save the third artifact as `setup_account.md`. Its task list and smoke tests are mandatory before declaring the customer app complete.