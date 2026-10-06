import { describe, it, expect } from 'vitest';
import { firstFreeNumber, firstFreeName } from './tables.js';

/**
 * Number and name allocation for new tables.
 *
 * This went through two wrong answers before the right one: `tables.length + 1`
 * (with 1-5, deleting #3 proposed 5, which existed) and then `max + 1` (with
 * 1, 2, 4, 5 it proposed 6 while 3 sat free). The gap case is the whole point,
 * so it is the first thing asserted.
 */
describe('firstFreeNumber', () => {
  it('reuses the gap left by a deleted table', () => {
    // The case max+1 got wrong.
    expect(firstFreeNumber([1, 2, 4, 5])).toBe(3);
  });

  it('starts at 1 for a venue with no tables', () => {
    expect(firstFreeNumber([])).toBe(1);
  });

  it('fills the lowest gap when several are free', () => {
    expect(firstFreeNumber([2, 3, 7])).toBe(1);
  });

  it('appends when the sequence is contiguous', () => {
    expect(firstFreeNumber([1, 2, 3])).toBe(4);
  });

  it('is not confused by unordered input or duplicates', () => {
    // Duplicates are possible: there is deliberately no DB constraint on
    // (tenant_id, number), so the allocator must not assume otherwise.
    expect(firstFreeNumber([5, 1, 3, 1, 2])).toBe(4);
  });

  it('ignores numbers that cannot be allocated anyway', () => {
    expect(firstFreeNumber([-1, 0, 1])).toBe(2);
  });
});

describe('firstFreeName', () => {
  it('uses the plain name when it is free', () => {
    expect(firstFreeName(['Terrace 1'], 3)).toBe('Table 3');
  });

  it('steps past a name already taken by a renamed table', () => {
    // "Table 3" can belong to a table numbered something else entirely —
    // someone renamed it. The admin did not choose this name, so the request
    // must not fail over it.
    expect(firstFreeName(['Table 3'], 3)).toBe('Table 3 (2)');
  });

  it('keeps stepping until it finds a free one', () => {
    expect(firstFreeName(['Table 3', 'Table 3 (2)', 'Table 3 (3)'], 3)).toBe('Table 3 (4)');
  });

  it('compares case-insensitively, matching the clash check', () => {
    // The uniqueness guard lowercases before comparing, so allocation has to
    // as well or it hands back a name the guard will then reject.
    expect(firstFreeName(['table 3'], 3)).toBe('Table 3 (2)');
  });
});
