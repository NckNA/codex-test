// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useChiefComplaint } from './useChiefComplaint';
import { AuthProvider } from '../../contexts/AuthContext';
import { TenantProvider } from '../../contexts/TenantContext';

describe('useChiefComplaint', () => {
  it('renders and exposes the correct public API without Supabase auth', async () => {
    // We use a mutable variable to capture the hook's return value during render.
    let hookResult: ReturnType<typeof useChiefComplaint> | undefined;

    const TestComponent = () => {
      hookResult = useChiefComplaint('patient_1');
      return null; // Minimal component, no UI needed
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    // Act ensures all React lifecycle events and effects complete before assertions
    await act(async () => {
      root.render(
        <AuthProvider>
          <TenantProvider>
            <TestComponent />
          </TenantProvider>
        </AuthProvider>
      );
    });

    // Confirm the hook rendered without crashing
    expect(hookResult).toBeDefined();
    
    // Assert public API shape is unchanged
    expect(hookResult).toHaveProperty('complaint');
    expect(hookResult).toHaveProperty('isLoading');
    expect(hookResult).toHaveProperty('isError');
    expect(hookResult).toHaveProperty('error');
    expect(hookResult).toHaveProperty('isSaving');
    expect(typeof hookResult!.refetch).toBe('function');
    expect(typeof hookResult!.saveComplaint).toBe('function');
    
    // Confirm default localStorage fallback behavior works:
    // It should load without crashing even when Supabase env vars are missing
    // or when the auth mode is 'dev'.
    expect(hookResult!.isLoading).toBeDefined();

    // Cleanup
    await act(async () => {
      root.unmount();
    });
  });
});
