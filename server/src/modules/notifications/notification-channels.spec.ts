import { describe, it, expect } from 'vitest';
import { notification_type_enum } from '@prisma/client';
import { NOTIFICATION_CHANNELS } from './notification-channels.constants';

// The likely mistake with this map is adding an enum value and forgetting the
// entry, which makes that notification silently send nothing. TypeScript's
// Record already catches a missing key at compile time; this catches the case
// where someone widens the type or the enum drifts at runtime.
describe('NOTIFICATION_CHANNELS', () => {
  const types = Object.values(notification_type_enum);

  it('has an entry for every notification type', () => {
    const missing = types.filter((t) => !NOTIFICATION_CHANNELS[t]);
    expect(missing).toEqual([]);
  });

  it('never routes a type to zero channels', () => {
    const silent = types.filter(
      (t) => (NOTIFICATION_CHANNELS[t] ?? []).length === 0,
    );
    expect(silent).toEqual([]);
  });

  it('always includes IN_APP, because the bell is the source of truth', () => {
    const noBell = types.filter(
      (t) => !(NOTIFICATION_CHANNELS[t] ?? []).includes('IN_APP'),
    );
    expect(noBell).toEqual([]);
  });
});
