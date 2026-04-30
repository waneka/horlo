# Plan 21-02 Task 1 — DNS verification (post-propagation)

Captures the dig output proving every record submitted in Plan 21-01 Task 2 has propagated and is being served correctly. Run before creating the Resend API key (Step 3).

Run date: 2026-04-30

## SPF — `send.mail.horlo.app` (TXT)

```
$ dig +short TXT send.mail.horlo.app
"v=spf1 include:amazonses.com ~all"
```

✓ Matches Resend-issued value (transcribed in `evidence/dns-submitted.md`).

## DKIM — `resend._domainkey.mail.horlo.app` (TXT)

```
$ dig +short TXT resend._domainkey.mail.horlo.app
"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3qwrAy5mXsDTiABK+B3H2uVFjmfVOKABpNHSAagu8mRtzmjhMnst1RyrE7QcGJbW91yA2IO8DvkUzoLLxsHCVITHiTjrNR+CAayc0/0blwuxPFT9ppZRbHNg5naaFSev/2bbJf1htOSa4a3BdigIFybP7fBsRiTrVoh4rNm3lXQIDAQAB"
```

✓ Single DKIM key as Resend issued (DKIM count = 1).

## DMARC — `_dmarc.mail.horlo.app` (TXT)

```
$ dig +short TXT _dmarc.mail.horlo.app
(empty from default resolver — negative-cache TTL from pre-add lookup; not authoritative)

$ dig +short @thaddeus.ns.cloudflare.com TXT _dmarc.mail.horlo.app
"v=DMARC1; p=none;"

$ dig +short @mia.ns.cloudflare.com TXT _dmarc.mail.horlo.app
"v=DMARC1; p=none;"
```

✓ Authoritative Cloudflare nameservers confirm DMARC is published per D-11. Default resolver will catch up once the negative-cache entry expires (typically minutes to ~1 hour). Authoritative answer is the source of truth for acceptance.

## Bounce MX — `send.mail.horlo.app` (MX)

```
$ dig +short MX send.mail.horlo.app
10 feedback-smtp.us-east-1.amazonses.com.
```

✓ Priority 10, points at Amazon SES feedback host (us-east-1, matching Resend's region).

## Disposition

All four records are propagated and serving the values submitted in Plan 21-01. Resend dashboard verification (Step 2) and API key creation (Step 3) may proceed.
