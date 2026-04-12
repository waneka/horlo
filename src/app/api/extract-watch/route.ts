import { NextRequest, NextResponse } from 'next/server'
import { fetchAndExtract } from '@/lib/extractors'
import { SsrfError } from '@/lib/ssrf'

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

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP/HTTPS URLs are supported' },
        { status: 400 }
      )
    }

    const result = await fetchAndExtract(url)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Extraction error:', error)

    if (error instanceof SsrfError) {
      return NextResponse.json(
        { error: "That URL points to a private address and can't be imported." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to extract watch data from URL.' },
      { status: 500 }
    )
  }
}
