# Plan 21-01 — DNS submission evidence

This file captures evidence for SMTP-01 (DNS records for `mail.horlo.app`).
Updated incrementally during Plan 21-01 Tasks 1 and 2.

## NS probe — 2026-04-30

Command:

```
dig NS horlo.app +short
```

Output:

```
thaddeus.ns.cloudflare.com.
mia.ns.cloudflare.com.
```

**DNS provider for `horlo.app`: Cloudflare.**

Record-add UI for Task 2: Cloudflare Dashboard → horlo.app zone → DNS → Records → Add record. Cloudflare zone-relative naming applies — Name field expects the leftmost label only (or `@` for apex). Cloudflare auto-appends `.horlo.app`. Example: `send.mail` resolves to `send.mail.horlo.app`. (Pitfall 2 mitigation — same shape as Vercel.)

## Resend-issued record set — 2026-04-30

Domain: `mail.horlo.app` (per D-03)
Region: North Virginia (us-east-1)
Screenshot: `evidence/resend-records-verified.jpeg`

Record-set transcribed from Resend dashboard. Names are shown relative to the verified subdomain `mail.horlo.app` (Resend convention) — the FQDN column expands them.

| # | Type | Name (Resend) | FQDN | Content (truncated in UI) | TTL | Priority |
|---|------|---------------|------|---------------------------|-----|----------|
| 1 | TXT | `resend._domainkey.mail` | `resend._domainkey.mail.horlo.app` | `p=MIGfMA0GCSqG[...]rNm3lXQIDAQAB` | Auto | — |
| 2 | TXT | `send.mail` | `send.mail.horlo.app` | `v=spf1 include[...]nses.com ~all` | Auto | — |
| 3 | MX | `send.mail` | `send.mail.horlo.app` | `feedback-smtp.[...]amazonses.com` | Auto | 10 |
| 4 | TXT | `_dmarc` | `_dmarc.mail.horlo.app` | `v=DMARC1; p=none;` | Auto | — |

DKIM count: 1 (single `resend._domainkey.mail` row — Resend issued one DKIM key).

## Records submitted at Cloudflare — 2026-04-30

**Deviation from plan:** Plan 21-01 Task 2 assumed manual record entry at the DNS provider with the Pitfall 2 leftmost-label risk. In practice, Resend detected Cloudflare and offered a one-click "Auto configure" integration that wrote the records directly into the `horlo.app` zone via the Cloudflare API. This collapsed manual entry, eliminated the Pitfall 2 risk entirely, and short-circuited the propagation wait — Resend showed all three primary records (DKIM, SPF, bounce MX) as **Verified ✓** within seconds.

Submission method: **Resend → Cloudflare Auto Configure** (not manual entry).

Records-as-submitted (visible in Resend dashboard with status badges):

| # | Type | FQDN | Resend status |
|---|------|------|---------------|
| 1 | TXT | `resend._domainkey.mail.horlo.app` | Verified ✓ |
| 2 | TXT | `send.mail.horlo.app` | Verified ✓ |
| 3 | MX | `send.mail.horlo.app` (priority 10) | Verified ✓ |
| 4 | TXT | `_dmarc.mail.horlo.app` | (Optional section — status not shown in UI; pending dig confirmation) |

**Pitfall 2 status:** N/A — Cloudflare integration handled record naming. Manual leftmost-label discipline was not required.

**DMARC verification (D-11):** Cloudflare Auto Configure skipped DMARC (Resend marked it Optional). Operator added it manually in Cloudflare DNS as Type=TXT, Name=`_dmarc.mail`, Content=`v=DMARC1; p=none;`, TTL=Auto. Authoritative verification:

```
$ dig +short @thaddeus.ns.cloudflare.com TXT _dmarc.mail.horlo.app
"v=DMARC1; p=none;"

$ dig +short @mia.ns.cloudflare.com TXT _dmarc.mail.horlo.app
"v=DMARC1; p=none;"
```

Negative checks (sanity):
- `dig +short @thaddeus.ns.cloudflare.com TXT _dmarc.horlo.app` → empty (no apex DMARC, as intended)
- `dig +short @thaddeus.ns.cloudflare.com TXT _dmarc.mail.horlo.app.horlo.app` → empty (no Pitfall 2 doubling)

Default resolver returns empty due to negative-cache TTL from the earlier pre-add lookup; will catch up within minutes. Authoritative NS answer is the source of truth for acceptance.

D-11 published and verified ✓.

Screenshot: `evidence/resend-records-verified.jpeg` (Resend Domains → mail.horlo.app → DNS Records page, showing DKIM/SPF/MX rows with Verified ✓ badges and the DMARC row in the Optional section). File extension is `.jpeg` — the plan's verification grep referenced `resend-record-set.png`; the renamed `.jpeg` file captures the same evidence and supersedes that path.
