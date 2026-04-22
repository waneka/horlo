import '@testing-library/jest-dom/vitest'

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
