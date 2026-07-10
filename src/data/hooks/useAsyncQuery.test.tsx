// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncQuery } from './useAsyncQuery';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

interface Snapshot {
  data: string;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
let snapshot: Snapshot;

function Harness({ queryKey, queryFn, enabled = true }: { queryKey: string; queryFn: () => Promise<string>; enabled?: boolean }) {
  const current = useAsyncQuery({ queryKey, queryFn, enabled, resetOnDisable: true, initialData: '' });
  useEffect(() => { snapshot = current; }, [current]);
  return null;
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

describe('useAsyncQuery request generation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  it('ignores stale success when a newer query finishes first', async () => {
    const slowA = deferred<string>();
    const fastB = deferred<string>();
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => slowA.promise} />); });
    await act(async () => { root.render(<Harness queryKey="B" queryFn={() => fastB.promise} />); });
    fastB.resolve('patient B');
    await flush();
    expect(snapshot.data).toBe('patient B');
    slowA.resolve('patient A');
    await flush();
    expect(snapshot.data).toBe('patient B');
  });

  it('ignores stale error after the current query succeeds', async () => {
    const slowA = deferred<string>();
    const fastB = deferred<string>();
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => slowA.promise} />); });
    await act(async () => { root.render(<Harness queryKey="B" queryFn={() => fastB.promise} />); });
    fastB.resolve('patient B');
    await flush();
    slowA.reject(new Error('raw stale error'));
    await flush();
    expect(snapshot.data).toBe('patient B');
    expect(snapshot.isError).toBe(false);
    expect(snapshot.error).toBeNull();
  });

  it('does not let stale finally clear the latest loading state', async () => {
    const slowA = deferred<string>();
    const slowB = deferred<string>();
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => slowA.promise} />); });
    await act(async () => { root.render(<Harness queryKey="B" queryFn={() => slowB.promise} />); });
    slowA.resolve('patient A');
    await flush();
    expect(snapshot.isLoading).toBe(true);
    slowB.resolve('patient B');
    await flush();
    expect(snapshot.isLoading).toBe(false);
    expect(snapshot.data).toBe('patient B');
  });

  it('clears data immediately when query identity changes', async () => {
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => Promise.resolve('patient A')} />); });
    await flush();
    expect(snapshot.data).toBe('patient A');
    const pendingB = deferred<string>();
    await act(async () => { root.render(<Harness queryKey="B" queryFn={() => pendingB.promise} />); });
    expect(snapshot.data).toBe('');
    expect(snapshot.isLoading).toBe(true);
    pendingB.resolve('patient B');
    await flush();
  });

  it('invalidates requests and resets data when disabled', async () => {
    const pending = deferred<string>();
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => pending.promise} />); });
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => pending.promise} enabled={false} />); });
    expect(snapshot.data).toBe('');
    expect(snapshot.isLoading).toBe(false);
    pending.resolve('late data');
    await flush();
    expect(snapshot.data).toBe('');
  });

  it('does not update callbacks after unmount', async () => {
    const pending = deferred<string>();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => { root.render(<Harness queryKey="A" queryFn={() => pending.promise} />); });
    act(() => root.unmount());
    pending.resolve('late data');
    await flush();
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('unmounted'));
  });
});
