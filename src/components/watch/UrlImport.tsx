'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ExtractedWatchData, ExtractionResult } from '@/lib/extractors'

interface UrlImportProps {
  onDataExtracted: (data: ExtractedWatchData) => void
}

export function UrlImport({ onDataExtracted }: UrlImportProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)

  const handleExtract = async () => {
    if (!url.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/extract-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (result?.data) {
      onDataExtracted(result.data)
      setResult(null)
      setUrl('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Import from URL</CardTitle>
        <CardDescription>
          Paste a product page URL to auto-fill watch specs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="importUrl" className="sr-only">
              Product URL
            </Label>
            <Input
              id="importUrl"
              type="url"
              placeholder="https://www.omega.com/en-us/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleExtract} disabled={isLoading || !url.trim()}>
            {isLoading ? 'Extracting...' : 'Extract'}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {result && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Extraction Result</span>
              <Badge variant="outline">
                {result.confidence} confidence
              </Badge>
              {result.llmUsed && (
                <Badge variant="outline">AI-assisted</Badge>
              )}
            </div>

            <div className="text-sm space-y-1">
              {result.data.brand && (
                <p><span className="text-muted-foreground">Brand:</span> {result.data.brand}</p>
              )}
              {result.data.model && (
                <p><span className="text-muted-foreground">Model:</span> {result.data.model}</p>
              )}
              {result.data.reference && (
                <p><span className="text-muted-foreground">Reference:</span> {result.data.reference}</p>
              )}
              {result.data.caseSizeMm && (
                <p><span className="text-muted-foreground">Case Size:</span> {result.data.caseSizeMm}mm</p>
              )}
              {result.data.movement && (
                <p><span className="text-muted-foreground">Movement:</span> {result.data.movement}</p>
              )}
              {result.data.waterResistanceM && (
                <p><span className="text-muted-foreground">Water Resistance:</span> {result.data.waterResistanceM}m</p>
              )}
              {result.data.dialColor && (
                <p><span className="text-muted-foreground">Dial:</span> {result.data.dialColor}</p>
              )}
              {result.data.strapType && (
                <p><span className="text-muted-foreground">Strap:</span> {result.data.strapType}</p>
              )}
              {result.data.crystalType && (
                <p><span className="text-muted-foreground">Crystal:</span> {result.data.crystalType}</p>
              )}
              {result.data.complications?.length ? (
                <p><span className="text-muted-foreground">Complications:</span> {result.data.complications.join(', ')}</p>
              ) : null}
              {result.data.styleTags?.length ? (
                <p><span className="text-muted-foreground">Style:</span> {result.data.styleTags.join(', ')}</p>
              ) : null}
              {result.data.marketPrice && (
                <p><span className="text-muted-foreground">Price:</span> ${result.data.marketPrice.toLocaleString()}</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {result.fieldsExtracted.length} fields extracted
            </p>

            <div className="flex gap-2">
              <Button onClick={handleApply} size="sm">
                Apply to Form
              </Button>
              <Button
                onClick={() => setResult(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
