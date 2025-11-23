import { describe, it, expect, vi, beforeEach } from 'vitest';
import CacheService from '../src/renderer/services/cache-service';

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

describe('CacheService basic behaviors', () => {
  beforeEach(() => {
    (global as any).window = (global as any).window || {};
    (window as any).electron = undefined;
    Object.defineProperty(global, 'localStorage', {
      value: {
        clear: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      configurable: true
    });
  });

  it('memory set/get without IPC', async () => {
    const cs = new CacheService();
    await cs.set('k', 'v');
    const got = await cs.get('k');
    expect(got).toBe('v');
  });

  it('block set/get and stats with IPC fallback', async () => {
    const store = new Map<string, string>();
    (window as any).electron = {
      ipc: {
        invoke: vi.fn(async (channel: string, ...args: any[]) => {
          switch (channel) {
            case 'cache-get':
              return store.get(args[0]) || null;
            case 'cache-set':
              store.set(args[0], args[1]);
              return null;
            case 'cache-clear':
              store.clear();
              return null;
            case 'cache-stats':
              const size = Array.from(store.values()).reduce((acc, v) => acc + (v?.length || 0), 0);
              return { count: store.size, size };
            default:
              return null;
          }
        })
      }
    };

    const cs = new CacheService();
    await cs.setBlock('doc_1', 'src text', 'dst text');
    const blk = await cs.getBlock('doc_1');
    expect(blk).toEqual({ src: 'src text', dst: 'dst text' });

    const stats = await cs.getStats();
    expect(stats.count).toBe(1);
    expect(stats.size).toBeGreaterThan(0);

    await cs.clear();
    const stats2 = await cs.getStats();
    expect(stats2.count).toBe(0);
  });
});


