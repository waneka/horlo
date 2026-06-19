/**
 * Quick task 260614-f82: AI Gateway cover-gen script.
 * Usage: npm run explore:covers
 *   (loaded via --env-file=.env.local; reads AI_GATEWAY_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *    SUPABASE_SERVICE_ROLE_KEY from that file)
 *
 * Reads COVER-PROMPTS.md, generates 8 cover images via Vercel AI Gateway
 * (openai/gpt-image-1, medium quality, 1536×1024), uploads each to the
 * cms-covers Supabase Storage bucket via service-role client, and writes
 * scripts/seed-data/explore-cover-urls.json with the 8 public URLs.
 *
 * Idempotent on re-run: slugs already in the manifest with a live URL are skipped.
 * Exits 0 on full success, 1 on any failure.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as https from 'node:https'
import * as http from 'node:http'
import * as crypto from 'node:crypto'
import { experimental_generateImage as generateImage } from 'ai'
import { createClient } from '@supabase/supabase-js'

const TASK_DIR = path.join(
  process.cwd(),
  '.planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu',
)
const COVER_PROMPTS_FILE = path.join(TASK_DIR, 'COVER-PROMPTS.md')
const MANIFEST_FILE = path.join(process.cwd(), 'scripts/seed-data/explore-cover-urls.json')
const BUCKET_ID = 'cms-covers'

// ---------------------------------------------------------------------------
// Env validation (at runtime, not import time — allows lint/tsc without vars)
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.error(
      `[covers] ERROR: ${name} is not set.\n` +
        `This script requires:\n` +
        `  AI_GATEWAY_API_KEY  — Vercel AI Gateway key (https://vercel.com/dashboard → AI → Gateway)\n` +
        `  NEXT_PUBLIC_SUPABASE_URL — your Supabase project URL\n` +
        `  SUPABASE_SERVICE_ROLE_KEY — service-role key from Supabase Dashboard → API\n` +
        `Run via: npm run explore:covers  (loads from .env.local)`,
    )
    process.exit(1)
  }
  return val
}

// ---------------------------------------------------------------------------
// COVER-PROMPTS.md parser
// ---------------------------------------------------------------------------

interface CoverPrompt {
  slug: string
  title: string
  prompt: string
}

function parseCoverPrompts(content: string): CoverPrompt[] {
  const prompts: CoverPrompt[] = []
  // Split on ## headers
  const sections = content.split(/^## /m).filter((s) => s.trim())

  for (const section of sections) {
    const lines = section.split('\n')
    const slug = lines[0].trim()
    if (!slug) continue

    const slugMatch = section.match(/^slug:\s*(.+)$/m)
    const titleMatch = section.match(/^title:\s*(.+)$/m)
    // prompt: | ... block — everything after "prompt: |" until next key or end
    const promptMatch = section.match(/^prompt:\s*\|\n([\s\S]*?)(?=^[a-z_]+:|$)/m)

    const parsedSlug = slugMatch?.[1]?.trim() ?? slug
    const parsedTitle = titleMatch?.[1]?.trim() ?? ''
    const parsedPrompt = promptMatch?.[1]
      ? promptMatch[1]
          .split('\n')
          .map((l) => l.replace(/^  /, '')) // strip 2-space indent from YAML block
          .join('\n')
          .trim()
      : ''

    if (parsedSlug && parsedPrompt) {
      prompts.push({ slug: parsedSlug, title: parsedTitle, prompt: parsedPrompt })
    }
  }

  return prompts
}

// ---------------------------------------------------------------------------
// URL liveness check (HEAD request)
// ---------------------------------------------------------------------------

function headUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Validate env. PROD_-prefixed vars take priority so the script targets the
  // prod cms-covers bucket regardless of what NEXT_PUBLIC_SUPABASE_URL points
  // at locally (it is almost always 127.0.0.1:54321 during dev).
  const aiGatewayKey = requireEnv('AI_GATEWAY_API_KEY')
  const supabaseUrl = process.env.PROD_SUPABASE_URL ?? requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey =
    process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // Warn loudly when uploading to a localhost URL — almost always wrong for
  // this script (covers must land in prod cms-covers).
  if (/127\.0\.0\.1|localhost/.test(supabaseUrl)) {
    console.warn(
      `[covers] WARNING: Supabase URL points at localhost (${supabaseUrl}).\n` +
        '  Set PROD_SUPABASE_URL + PROD_SUPABASE_SERVICE_ROLE_KEY to target prod cms-covers.',
    )
  }

  // Check COVER-PROMPTS.md exists
  if (!fs.existsSync(COVER_PROMPTS_FILE)) {
    console.error(
      `[covers] ERROR: COVER-PROMPTS.md not found at ${COVER_PROMPTS_FILE}.\n` +
        'Run Task 2 first to create the drafts.',
    )
    process.exit(1)
  }

  const promptsContent = fs.readFileSync(COVER_PROMPTS_FILE, 'utf8')
  const coverPrompts = parseCoverPrompts(promptsContent)

  if (coverPrompts.length === 0) {
    console.error('[covers] ERROR: No prompts parsed from COVER-PROMPTS.md. Check the format.')
    process.exit(1)
  }
  console.log(`[covers] Parsed ${coverPrompts.length} prompts from COVER-PROMPTS.md`)

  // Load existing manifest (for idempotency)
  let manifest: Record<string, string> = {}
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'))
      console.log(`[covers] Existing manifest has ${Object.keys(manifest).length} slugs`)
    } catch {
      console.warn('[covers] WARNING: Could not parse existing manifest — starting fresh')
      manifest = {}
    }
  }

  // Service-role Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let anyFailed = false

  for (const { slug, prompt } of coverPrompts) {
    // Idempotency: skip if URL already in manifest AND is live
    if (manifest[slug]) {
      console.log(`[covers] ${slug}: checking existing URL...`)
      const alive = await headUrl(manifest[slug])
      if (alive) {
        console.log(`[covers] ${slug}: already in manifest + URL is live — skipping`)
        continue
      } else {
        console.log(`[covers] ${slug}: URL in manifest but HEAD failed — regenerating`)
      }
    }

    console.log(`[covers] ${slug}: generating image via AI Gateway...`)

    try {
      // Call Vercel AI Gateway via ai SDK v5 experimental_generateImage
      // The AI_GATEWAY_API_KEY env var is consumed by the SDK automatically
      // when using a model string (AI Gateway routing).
      const result = await generateImage({
        model: 'openai/gpt-image-1',
        prompt,
        n: 1,
        size: '1536x1024',
        providerOptions: {
          openai: { quality: 'medium' },
        },
        headers: {
          Authorization: `Bearer ${aiGatewayKey}`,
        },
      })

      const image = result.image
      const imageBuffer = Buffer.from(image.uint8Array)

      // Determine content type from response
      const contentType =
        image.mediaType && image.mediaType !== '' ? image.mediaType : 'image/png'
      const ext = contentType.includes('jpeg') ? 'jpg' : 'png'

      // Upload to cms-covers bucket under seed/ prefix
      const storagePath = `seed/${slug}-${crypto.randomUUID()}.${ext}`
      console.log(`[covers] ${slug}: uploading to ${BUCKET_ID}/${storagePath}...`)

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(storagePath, imageBuffer, {
          contentType,
          upsert: false,
        })

      if (uploadError) {
        console.error(`[covers] ${slug}: upload failed —`, uploadError.message)
        anyFailed = true
        continue
      }

      const { data: urlData } = supabase.storage.from(BUCKET_ID).getPublicUrl(storagePath)
      manifest[slug] = urlData.publicUrl
      console.log(`[covers] ${slug}: generated cover — ${urlData.publicUrl}`)

      // Persist manifest after each success (crash-safe)
      fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true })
      fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8')
    } catch (err) {
      console.error(`[covers] ${slug}: generation failed —`, err)
      anyFailed = true
    }
  }

  // Final manifest write
  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true })
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8')

  const successCount = Object.keys(manifest).length
  console.log(
    `[covers] Done — ${successCount}/${coverPrompts.length} slugs in manifest. Written to ${MANIFEST_FILE}`,
  )

  if (anyFailed) {
    console.error('[covers] One or more slugs failed — re-run to retry missing slugs.')
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('[covers] fatal:', err)
  process.exit(1)
})
