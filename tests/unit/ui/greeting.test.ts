import { describe, expect, it } from 'vitest';

import { buildUserGreeting } from '@/lib/ui/greeting';

describe('buildUserGreeting', () => {
  it('returns a playful local-mode greeting', () => {
    const greeting = buildUserGreeting({
      mode: 'local',
      now: new Date('2026-06-17T09:00:00'),
    });

    expect(greeting).toMatch(/本機模式|觀察筆記本|這台裝置/);
    expect(greeting).not.toContain('你好，');
  });

  it('uses the display name in signed-in greetings', () => {
    const greeting = buildUserGreeting({
      displayName: 'Mawer',
      mode: 'signed-in',
      now: new Date('2026-06-17T09:00:00'),
    });

    expect(greeting).toContain('Mawer');
    expect(greeting).not.toContain('{name}');
  });

  it('varies greetings by time of day', () => {
    const morning = buildUserGreeting({
      displayName: 'Mawer',
      mode: 'signed-in',
      now: new Date('2026-06-17T08:00:00'),
    });
    const evening = buildUserGreeting({
      displayName: 'Mawer',
      mode: 'signed-in',
      now: new Date('2026-06-17T19:00:00'),
    });

    expect(morning).not.toBe(evening);
  });
});
