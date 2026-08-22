import { describe, it, expect, vi } from 'vitest';
import { role_enum } from '@prisma/client';

import {
  INTERNAL_ROLE_ROOMS,
  NotificationsGateway,
} from './notifications.gateway';

// `broadcast()` emitted to the whole /performx namespace. That was harmless
// until Phase 2 gave external vendors a login on it, at which point three poll
// calls started reaching them. `sendToInternal` is the replacement and these
// cover the only thing that makes it safer: which rooms it names.

describe('INTERNAL_ROLE_ROOMS', () => {
  it('leaves the vendor room out', () => {
    expect(INTERNAL_ROLE_ROOMS).not.toContain(`role:${role_enum.VENDOR}`);
  });

  it('covers every other role, so nobody internal silently stops hearing', () => {
    const expected = Object.values(role_enum)
      .filter((role) => role !== role_enum.VENDOR)
      .map((role) => `role:${role}`);
    expect([...INTERNAL_ROLE_ROOMS].sort()).toEqual(expected.sort());
  });

  it('is one room short of the full enum', () => {
    expect(INTERNAL_ROLE_ROOMS).toHaveLength(
      Object.values(role_enum).length - 1,
    );
  });
});

describe('sendToInternal', () => {
  it('targets the internal rooms rather than the namespace', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const gateway = new NotificationsGateway({} as never, {} as never);
    (gateway as unknown as { server: unknown }).server = {
      to,
      emit: vi.fn(() => {
        throw new Error('namespace emit reaches vendor logins');
      }),
    };

    gateway.sendToInternal('poll:updated', { id: 'p1' });

    expect(to).toHaveBeenCalledWith(INTERNAL_ROLE_ROOMS);
    expect(emit).toHaveBeenCalledWith('poll:updated', { id: 'p1' });
  });
});
