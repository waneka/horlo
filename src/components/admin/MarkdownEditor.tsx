'use client'

// D-13: Plain-textarea-with-live-preview markdown editor.
//
// Tabs primitive (Edit / Preview). Edit tab shows a Textarea with auto-height
// (field-sizing-content). Preview tab renders react-markdown output.
// Preview updates only on tab switch — no live keystroke updates.
// NO prose class (no @tailwindcss/typography installed).
// UI-SPEC §Markdown editor: preview container classes exactly as specified.

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write some markdown…',
  disabled = false,
}: MarkdownEditorProps) {
  // Cache the preview content at the point of the last tab switch.
  // Only re-renders on switching to "preview" tab — not on every keystroke.
  const [previewContent, setPreviewContent] = useState(value)

  return (
    <Tabs defaultValue="edit">
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger
          value="preview"
          onClick={() => setPreviewContent(value)}
        >
          Preview
        </TabsTrigger>
      </TabsList>

      <TabsContent value="edit">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-16 field-sizing-content mt-2"
        />
      </TabsContent>

      <TabsContent value="preview">
        {/* UI-SPEC §CSS Chain Assertions 3: no overflow-hidden, use overflow-y-auto if capped */}
        <div className="mt-2 min-h-[120px] p-3 rounded-lg border border-input bg-transparent text-sm leading-relaxed overflow-y-auto">
          {previewContent.trim() ? (
            // NO prose class — @tailwindcss/typography not installed.
            // react-markdown inherits text-sm leading-relaxed from container.
            <ReactMarkdown>{previewContent}</ReactMarkdown>
          ) : (
            <span className="text-muted-foreground italic">Nothing to preview yet.</span>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
