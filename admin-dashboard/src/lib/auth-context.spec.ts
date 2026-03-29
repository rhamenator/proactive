import React, { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

// Tell React's test utilities that this file runs in an act-aware environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createApiClientMock: vi.fn(),
  readStoredSessionMock: vi.fn(),
  writeStoredSessionMock: vi.fn(),
  clearStoredSessionMock: vi.fn(),
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
  clearStoredSession: mocks.clearStoredSessionMock
}));

import { AuthProvider, useAuthedApi } from './auth-context';

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
    mocks.router.push.mockReset();
    mocks.router.replace.mockReset();

    mocks.readStoredSessionMock.mockReturnValue({
      token: null,
      user: null
    });
    mocks.createApiClientMock.mockReturnValue({
      me: vi.fn()
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
});
