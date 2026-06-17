type GreetingMode = 'signed-in' | 'local';

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

type BuildUserGreetingOptions = {
  displayName?: string | null;
  mode: GreetingMode;
  now?: Date;
};

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }

  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }

  if (hour >= 17 && hour < 22) {
    return 'evening';
  }

  return 'night';
}

function pickBySeed<T>(items: readonly T[], seed: number): T {
  return items[((seed % items.length) + items.length) % items.length];
}

function getDaySeed(date: Date) {
  return date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
}

const localGreetings = [
  '嗨！本機模式開好了，一起來紀錄吧～',
  '來了來了！先在這台裝置上記錄，隨時開始',
  '嘿～你的觀察筆記本已就緒，本機模式啟動中',
] as const;

const signedInGreetings: Record<TimeSlot, readonly string[]> = {
  morning: [
    '早呀，{name}！',
    '{name}，早安！精神滿格了嗎？',
    '哈囉 {name}！新的一天，新的觀察',
  ],
  afternoon: [
    '午安呀，{name}！來記一筆吧',
    '{name}，下午好～此刻狀態如何？',
    '嘿，{name}！午後時光，喘口氣記一筆',
  ],
  evening: [
    '{name}，傍晚好！今天過得怎麼樣？',
    '嗨 {name}～一起回顧今天吧',
    '晚安前來打卡，{name}！',
  ],
  night: [
    '{name}，夜深了還醒著呀',
    '夜貓 {name} 出沒！記一筆再睡？',
    '嘿 {name}～這麼晚還在，記得休息',
  ],
};

export function buildUserGreeting({
  displayName,
  mode,
  now = new Date(),
}: BuildUserGreetingOptions): string {
  const seed = getDaySeed(now);

  if (mode === 'local') {
    return pickBySeed(localGreetings, seed);
  }

  const name = displayName?.trim() || '你';
  const slot = getTimeSlot(now.getHours());
  const template = pickBySeed(signedInGreetings[slot], seed + now.getHours());

  return template.replaceAll('{name}', name);
}
