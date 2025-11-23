import { describe, it, expect } from 'vitest';
import { generateBlockId, generatePageCacheKey } from '../src/renderer/utils/hash.js';

describe('hash utilities', () => {
  it('generateBlockId', () => {
    expect(generateBlockId('abcd', 2, 3)).toBe('abcd_p2_b3');
  });

  it('generatePageCacheKey', () => {
    expect(generatePageCacheKey('abcd', 5)).toBe('trans_abcd_p5');
  });
});


