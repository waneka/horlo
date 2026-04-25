import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// React Testing Library's `waitFor` auto-advances Jest fake timers by checking
// `typeof jest !== 'undefined'`. Vitest's `vi.useFakeTimers()` does set
// `setTimeout.clock` (which RTL also checks), but `jest` is undefined so RTL
// falls back to real-timer polling — which deadlocks tests that combine
// `vi.useFakeTimers()` with `waitFor()` (the polling setInterval is itself
// faked and never fires).
//
// This shim aliases a minimal `jest` global to `vi` so RTL detects fake timers
// and calls `jest.advanceTimersByTime(interval)` (which is now
// `vi.advanceTimersByTime`). Standard vitest+RTL workaround documented in
// vitest's migration guide. Only the timer-related members RTL actually uses
// are forwarded.
if (typeof (globalThis as { jest?: unknown }).jest === 'undefined') {
  Object.defineProperty(globalThis, 'jest', {
    value: {
      advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
      runAllTimers: () => vi.runAllTimers(),
      useFakeTimers: () => vi.useFakeTimers(),
      useRealTimers: () => vi.useRealTimers(),
    },
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement window.matchMedia — stub it so libraries like
// next-themes that probe `(prefers-color-scheme: dark)` do not crash under test.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Node 25 exposes a native `localStorage` without method implementations
// (warns `--localstorage-file was provided without a valid path`). That object
// leaks through vitest's jsdom env and shadows jsdom's functional storage
// on both `globalThis` AND `window`, breaking any test that exercises
// `localStorage.setItem` / `.getItem`. Install a minimal in-memory Storage
// implementation so code-under-test can read/write as it would in a browser.
if (
  typeof window !== 'undefined' &&
  typeof window.localStorage?.setItem !== 'function'
) {
  class MemoryStorage implements Storage {
    private store: Map<string, string> = new Map()
    get length() {
      return this.store.size
    }
    clear(): void {
      this.store.clear()
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value))
    }
    removeItem(key: string): void {
      this.store.delete(key)
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null
    }
  }
  const ls = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(window, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement IntersectionObserver — stub it so libraries like
// embla-carousel-react (which observes slide-in-view for lazy rendering) do
// not crash under test. The stub is a no-op that satisfies the constructor
// signature; tests don't need real intersection semantics.
if (
  typeof window !== 'undefined' &&
  typeof window.IntersectionObserver === 'undefined'
) {
  class StubIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []
    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    value: StubIntersectionObserver,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: StubIntersectionObserver,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement ResizeObserver — stub it for the same reason as
// IntersectionObserver. embla-carousel-react observes viewport size changes
// and crashes without this.
if (
  typeof window !== 'undefined' &&
  typeof window.ResizeObserver === 'undefined'
) {
  class StubResizeObserver implements ResizeObserver {
    constructor(_cb: ResizeObserverCallback) {}
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    value: StubResizeObserver,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: StubResizeObserver,
    writable: true,
    configurable: true,
  })
}
