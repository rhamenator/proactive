import React, { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

// Tell React's test utilities that this file runs in an act-aware environment.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createApiClientMock: vi.fn(),
  readStoredSessionMock: vi.fn(),
  writeStoredSessionMock: vi.fn(),
  clearStoredSessionMock: vi.fn(),
  readOriginalSessionMock: vi.fn(),
  writeOriginalSessionMock: vi.fn(),
  clearOriginalSessionMock: vi.fn(),
  router: {
    push: vi.fn(),
    replace: vi.fn()
  }
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router
}));

vi.mock('./api', () => ({
  createApiClient: mocks.createApiClientMock,
  getErrorMessage: (value: unknown) => String(value)
}));

vi.mock('./storage', () => ({
  readStoredSession: mocks.readStoredSessionMock,
  writeStoredSession: mocks.writeStoredSessionMock,
  clearStoredSession: mocks.clearStoredSessionMock,
  readOriginalSession: mocks.readOriginalSessionMock,
  writeOriginalSession: mocks.writeOriginalSessionMock,
  clearOriginalSession: mocks.clearOriginalSessionMock
}));

import { AuthProvider, useAuth, useAuthedApi } from './auth-context';

describe('AuthContext', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.createApiClientMock.mockReset();
    mocks.readStoredSessionMock.mockReset();
    mocks.writeStoredSessionMock.mockReset();
    mocks.clearStoredSessionMock.mockReset();
    mocks.readOriginalSessionMock.mockReset();
    mocks.writeOriginalSessionMock.mockReset();
    mocks.clearOriginalSessionMock.mockReset();
    mocks.router.push.mockReset();
    mocks.router.replace.mockReset();

    mocks.readStoredSessionMock.mockReturnValue({
      token: null,
      user: null
    });
    mocks.createApiClientMock.mockReturnValue({
      me: vi.fn()
    });
    mocks.readOriginalSessionMock.mockReturnValue({
      token: null,
      user: null
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('memoizes the authenticated API client while the token is unchanged', async () => {
    const seenClients: unknown[] = [];

    function Probe() {
      const api = useAuthedApi();
      const [, setTick] = useState(0);
      seenClients.push(api);

      return React.createElement(
        'button',
        {
          id: 'rerender',
          onClick: () => setTick((value) => value + 1)
        },
        'rerender'
      );
    }

    await act(async () => {
      root.render(React.createElement(AuthProvider, null, React.createElement(Probe)));
    });

    const button = container.querySelector('#rerender');
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.createApiClientMock).toHaveBeenCalledTimes(1);
    expect(seenClients.at(-1)).toBe(seenClients[0]);
  });

  it('runs sensitive actions through MFA step-up and uses the refreshed token', async () => {
    const secureExportMock = vi.fn().mockResolvedValue({ ok: true });
    const initialClient = {
      me: vi.fn().mockResolvedValue({
        id: 'admin-1',
        firstName: 'Ada',
        lastName: 'Admin',
        email: 'ada@example.com',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString()
      }),
      mfaStepUp: vi.fn().mockResolvedValue({
        accessToken: 'fresh-token',
        token: 'fresh-token',
        user: {
          id: 'admin-1',
          firstName: 'Ada',
          lastName: 'Admin',
          email: 'ada@example.com',
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString()
        }
      })
    };
    const freshClient = {
      exportVanResults: secureExportMock
    };

    mocks.readStoredSessionMock.mockReturnValue({
      token: 'stored-token',
      user: {
        id: 'admin-1',
        firstName: 'Ada',
        lastName: 'Admin',
        email: 'ada@example.com',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    });
    mocks.createApiClientMock.mockImplementation((token?: string | null) =>
      token === 'fresh-token' ? freshClient : initialClient
    );

    function Probe() {
      const { ready, runSensitiveAction } = useAuth();

      if (!ready) {
        return React.createElement('div', { id: 'booting' }, 'booting');
      }

      return React.createElement(
        'button',
        {
          id: 'sensitive',
          onClick: () => {
            void runSensitiveAction('generate an export', (api) => api.exportVanResults());
          }
        },
        'go'
      );
    }

    await act(async () => {
      root.render(React.createElement(AuthProvider, null, React.createElement(Probe)));
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector('#sensitive')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector('#step-up-code') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, '123456');
      input!.dispatchEvent(new InputEvent('input', { bubbles: true, data: '123456' }));
    });

    await act(async () => {
      const buttons = Array.from(container.querySelectorAll('button'));
      const verify = buttons.find((button) => button.textContent?.includes('Verify And Continue'));
      verify!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(initialClient.mfaStepUp).toHaveBeenCalledWith('123456');
    expect(secureExportMock).toHaveBeenCalledTimes(1);
    expect(mocks.writeStoredSessionMock).toHaveBeenCalledWith(
      'fresh-token',
      expect.objectContaining({ id: 'admin-1', role: 'admin' })
    );
  });
});
