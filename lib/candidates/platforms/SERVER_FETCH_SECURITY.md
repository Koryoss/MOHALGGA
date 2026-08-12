# Server-side URL fetch — security boundary (design only, not implemented)

Status: **not built**. Current stage (P0) does URL-pattern extraction only,
client-side, no network fetch to Naver Map / Catchtable. This document exists
so that *if and when* a server-side `fetchHtml` (see `platforms/types.ts`
`HtmlFetcher`) is approved, it is built against a defined security boundary
instead of a bare `fetch(url)`.

## Why this is needed

`ExtractOptions.fetchHtml` lets a caller inject an HTML fetcher into the
Naver Map / Catchtable adapters. The moment that fetcher is backed by a
real outbound request from our server, the server becomes a proxy that
will fetch *any URL a user pastes* — the textbook SSRF setup. The adapter
code itself does not change; the fetcher implementation is what needs the
boundary below.

## Required controls before shipping a real fetcher

**1. Allowlist by resolved host, not by string match on the input URL.**
Checking `url.hostname` against `map.naver.com` / `catchtable.co.kr` is not
enough — DNS can resolve an allowed-looking hostname to an internal IP
("DNS rebinding"), and a redirect can hop to a different host entirely.
Resolve the hostname to an IP first, validate the IP, connect to that IP
directly (pin it), and re-validate after every hop.

**2. Block private / reserved IP ranges on every resolved address.**
Reject anything that resolves to: `127.0.0.0/8`, `10.0.0.0/8`,
`172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (includes the cloud
metadata endpoint `169.254.169.254`), `::1`, `fc00::/7`, `fe80::/10`, and
any non-global unicast address. This is the single most important control —
it's what stops "paste a link that resolves to our own infra" attacks.

**3. Do not follow redirects blindly.**
Disable automatic redirect-following in the HTTP client. Read the
`Location` header manually, re-run the full URL validation (protocol,
allowlisted host, resolved-IP check) on the redirect target, and cap the
chain at a small fixed number of hops (e.g. 3). A redirect chain is exactly
how an allowlisted URL can end up pointing at an internal service.

**4. Restrict protocol and port.**
`http:`/`https:` only — no `file:`, `ftp:`, `gopher:`, etc. Default ports
only (80/443) unless there's a specific reason to allow otherwise; block
`file://`-style and unusual port targeting used to probe internal services.

**5. Treat the response as untrusted, bounded data.**
Cap response size (e.g. 1–2 MB) and set a request timeout (e.g. 5s).
Read only enough of the body to find the `<head>` meta tags — don't buffer
an arbitrarily large response. Never execute anything from the response
(no JS evaluation); the existing `extractMetaContent()` is a plain regex
over text, which is intentionally the safest option here (no DOM/HTML
parser with its own attack surface).

**6. Rate-limit per user/session.**
A working fetcher is also a generic "make our server hit any URL"
primitive if abused — cap requests per user per minute regardless of
whether the URL passes the allowlist, so it can't be used for internal
port-scanning via repeated calls with different paths/ports.

**7. Log and alert on rejected URLs.**
Any request that fails the private-IP or redirect checks should be logged
with enough context to spot a scanning pattern, not just silently dropped.

## Explicit non-goals for this control

- This is not a general-purpose scraping/crawling permission. It only ever
  fetches a single og:meta-bearing HTML page for a URL the user themselves
  pasted, on an allowlist of two hosts.
- No headless browser / JS execution — if a target page requires
  JS-rendering to expose its metadata, that page is out of scope rather
  than a reason to add a browser sandbox here.
- Instagram is explicitly out of scope (no official API for this use case;
  see project instruction not to build scraping workarounds for platforms
  without one).

## Where this plugs in

`ExtractOptions.fetchHtml: (url: string) => Promise<string>` in
`platforms/types.ts` is the only seam. The allowlist/redirect/private-IP
checks above belong entirely inside that implementation (a server route or
edge function), not inside the adapters — the adapters should keep
assuming "whatever HTML I got back is untrusted text I regex over," and
know nothing about how it was fetched.
