import { describe, it, expect, vi, beforeEach } from 'vitest';
import TranslationService from '../src/renderer/services/translation-service';

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

describe('TranslationService queue and concurrency', () => {
  beforeEach(() => {
    (global as any).window = (global as any).window || {};
  });

  it('should not exceed maxConcurrent when processing tasks', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    (window as any).electron = {
      ipc: {
        invoke: vi.fn(async () => {
          inflight++;
          maxInflight = Math.max(maxInflight, inflight);
          await delay(50);
          inflight--;
          return 'ok';
        })
      }
    };

    const svc = new TranslationService();
    svc.maxConcurrent = 2;

    const tasks = Array.from({ length: 6 }, (_, i) =>
      svc.translate({ text: 't' + i })
    );

    const results = await Promise.all(tasks);
    expect(results.every(r => r === 'ok')).toBe(true);
    expect(maxInflight).toBeLessThanOrEqual(2);
  });
});


