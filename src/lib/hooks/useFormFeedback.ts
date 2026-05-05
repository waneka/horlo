'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actionTypes'

/**
 * Phase 25 / UX-06 — shared form-feedback primitive.
 *
 * Wraps `useTransition` + `toast.success/error` + local banner state into one
 * pattern. Implements Decisions D-16 (hybrid 5s success / persistent error
 * timing), D-17 (component+hook split), D-18 (optimistic-update carve-out is
 * the CALLER's responsibility — see below), and D-19 (dialogMode flag).
 *
 * Hybrid behavior (UI-SPEC §"useFormFeedback Hook Contract"):
 *
 *   | Mode                     | Toast                | Banner                                  |
 *   | ------------------------ | -------------------- | --------------------------------------- |
 *   | dialogMode: false        | toast.success(msg)   | <FormStatusBanner state="success" />    |
 *   |                          |   3s auto-dismiss    |   5s auto-dismiss (state→idle)          |
 *   | dialogMode: true         | toast.success(msg)   | (consumer suppresses banner)            |
 *   | Error (any mode)         | toast.error(msg)     | <FormStatusBanner state="error" />      |
 *   |                          |                      |   PERSISTENT until next run() (D-16)    |
 *
 * Optimistic-update carve-out (D-18): the hook does NOT special-case
 * `<PrivacyToggleRow>` or any other useOptimistic component. It is the
 * CALLER's job (in 25-06) to opt out of the success path for optimistic
 * components — call run() only on error/revert, or skip the hook entirely
 * for the happy path. The hook stays generic.
 *
 * Phase 28 D-04 / UX-09 extension — `successAction?: { label, href }` opt:
 *   When provided, the success toast emits Sonner's built-in action slot with
 *   `label` and an internally-wired `onClick: () => router.push(href)`. Caller
 *   passes declarative `{ label, href }`; the hook owns the router.push.
 *   When both `successMessage` and `successAction` are undefined, the hook
 *   short-circuits and does NOT call toast.success — used by callers
 *   implementing the D-05 suppress-toast rule when post-commit landing
 *   matches the action destination.
 *
 * Anti-patterns to avoid (per UI-SPEC):
 *   - DO NOT auto-clear the error state. Errors persist until the next run()
 *     call (D-16; UI-SPEC Anti-Pattern #8).
 *   - DO NOT call startTransition in addition to this hook's internal
 *     useTransition from consumer forms — let the hook own the transition.
 *   - DO NOT use useFormStatus here — that pattern is for inline
 *     <form action={sa}> submits (D-20 / 25-06 MarkAllReadButton); this hook
 *     composes around useTransition for the manual-submit pattern that 8+
 *     Phase 25 forms use.
 */
export interface UseFormFeedbackOptions {
  /** When true (dialog forms — D-19), the consumer should suppress the inline
   * banner; toast still fires normally. The hook tracks `state` either way —
   * it just exposes `dialogMode` so the consumer can branch. */
  dialogMode?: boolean
}

export interface UseFormFeedbackReturn<T> {
  /** Mirrors React's useTransition().isPending — canonical pending source. */
  pending: boolean
  state: 'idle' | 'pending' | 'success' | 'error'
  message: string | null
  /** Echoes options.dialogMode (default false) so consumers don't re-pass it. */
  dialogMode: boolean
  run: (
    action: () => Promise<ActionResult<T>>,
    opts?: {
      successMessage?: string
      errorMessage?: string
      /** Phase 28 D-04 — when set, the success toast renders Sonner's built-in
       *  action slot with `label` and an internally-wired
       *  `onClick: () => router.push(href)`. Caller passes declarative
       *  `{ label, href }`; the hook owns the router.push. */
      successAction?: { label: string; href: string }
    },
  ) => Promise<void>
  reset: () => void
}

const SUCCESS_AUTO_DISMISS_MS = 5000

export function useFormFeedback<T = unknown>(
  options?: UseFormFeedbackOptions,
): UseFormFeedbackReturn<T> {
  const dialogMode = options?.dialogMode ?? false
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState<string | null>(null)

  // Track the auto-dismiss timeout handle so we can clear it on reset(),
  // unmount, or the next run() invocation. ReturnType<typeof setTimeout> works
  // in both Node and browser typings — we don't depend on either.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track unmount so we can short-circuit any setState scheduled by an
  // in-flight action that resolves AFTER unmount (Test 15 — no warnings).
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const reset = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (!mountedRef.current) return
    setState('idle')
    setMessage(null)
  }, [])

  const run = useCallback(
    async (
      action: () => Promise<ActionResult<T>>,
      opts?: {
        successMessage?: string
        errorMessage?: string
        successAction?: { label: string; href: string }
      },
    ) => {
      // D-16: "Both clear on next form interaction." reset() clears any pending
      // 5s success timer AND wipes prior state/message before the new run.
      reset()
      if (!mountedRef.current) return
      setState('pending')
      setMessage(null)

      // Wrap the awaited action in startTransition so React batches the
      // setState calls that fire after the action resolves (avoids extra
      // renders + keeps `pending` accurate against the canonical isPending).
      let result: ActionResult<T>
      try {
        // We cannot directly await inside startTransition's callback signature;
        // instead, capture the promise and await it outside, then dispatch the
        // resulting setState inside startTransition.
        result = await action()
      } catch (err) {
        // Treat thrown errors as failures — actions SHOULD return ActionResult,
        // but a network/transport error could throw. Surface a generic message.
        if (!mountedRef.current) return
        const errMsg =
          opts?.errorMessage ??
          (err instanceof Error ? err.message : 'Could not save. Please try again.')
        startTransition(() => {
          setState('error')
          setMessage(errMsg)
        })
        toast.error(errMsg)
        return
      }

      if (!mountedRef.current) return

      if (result.success) {
        const callerProvidedMessage = opts?.successMessage !== undefined
        const callerProvidedAction = opts?.successAction !== undefined
        // Phase 28 D-05 caller-side suppress: when caller passes neither
        // successMessage NOR successAction, do NOT fire the success toast.
        // Internal state still goes success → 5s → idle so the banner reflects
        // the success regardless of the toast suppression.
        const suppressToast = !callerProvidedMessage && !callerProvidedAction
        const msg = opts?.successMessage ?? 'Saved'
        startTransition(() => {
          setState('success')
          setMessage(msg)
        })
        if (!suppressToast) {
          // Phase 28 D-04: Sonner action slot when successAction is provided.
          const successAction = opts?.successAction
          const sonnerOpts = successAction
            ? {
                action: {
                  label: successAction.label,
                  onClick: () => router.push(successAction.href),
                },
              }
            : undefined
          toast.success(msg, sonnerOpts)
        }
        // Schedule the 5s auto-dismiss (D-16) regardless of toast suppression —
        // the internal state lifecycle does NOT depend on whether toast fired.
        // Errors do NOT get this — they persist until the next run() call.
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          if (!mountedRef.current) return
          setState('idle')
          setMessage(null)
        }, SUCCESS_AUTO_DISMISS_MS)
      } else {
        const errMsg = opts?.errorMessage ?? result.error
        startTransition(() => {
          setState('error')
          setMessage(errMsg)
        })
        toast.error(errMsg)
        // No timeout scheduled — error persists until next run() (D-16).
      }
    },
    [reset, router],
  )

  return {
    pending,
    state,
    message,
    dialogMode,
    run,
    reset,
  }
}
