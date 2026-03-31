import { afterAll, afterEach, beforeAll } from 'vitest';

import { mswServer } from './msw-server';

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});
