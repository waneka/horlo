import { NextRequest, NextResponse } from 'next/server'
import { fetchAndExtract } from '@/lib/extractors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP/HTTPS URLs are supported' },
        { status: 400 }
      )
    }

    // Check if LLM is available
    const hasLlmKey = !!process.env.ANTHROPIC_API_KEY

    // Extract data
    const result = await fetchAndExtract(url, {
      useLlmFallback: hasLlmKey,
    })

    return NextResponse.json({
      success: true,
      ...result,
      llmAvailable: hasLlmKey,
    })
  } catch (error) {
    console.error('Extraction error:', error)

    const message = error instanceof Error ? error.message : 'Extraction failed'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
