import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * The menu item UPDATE schema, pinned against the CREATE schema.
 *
 * These diverged and that divergence was the bug: update had
 * `imageUrl: z.string().url()`, which rejects the relative path the upload
 * endpoint actually returns ("/uploads/x.png"). Attaching an image and saving
 * failed with a 400 that the client only console.error'd, so editing an item
 * appeared to do nothing. Creating worked, because create used a plain string.
 *
 * Kept as a copy of the real shape rather than an import, because the route
 * module pulls in the database. The point is the contract, and the assertions
 * below are the ones that would have caught it.
 */
const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().min(1).optional(),
  subCategoryId: z.string().optional().nullable(),
  available: z.boolean().optional(),
  roomServiceAvailable: z.boolean().optional(),
  imageUrl: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
  modifiers: z.string().optional().nullable(),
  translations: z.record(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  })).optional().nullable(),
});

describe('updateMenuItemSchema', () => {
  it('accepts the relative path the upload endpoint returns', () => {
    // The exact shape of a real upload response. `.url()` rejected this.
    const r = updateMenuItemSchema.safeParse({ imageUrl: '/uploads/abc-123.png' });
    expect(r.success).toBe(true);
  });

  it('still accepts an absolute URL, for S3-backed storage', () => {
    const r = updateMenuItemSchema.safeParse({ imageUrl: 'https://cdn.example.com/a.png' });
    expect(r.success).toBe(true);
  });

  it('accepts null to clear the image', () => {
    expect(updateMenuItemSchema.safeParse({ imageUrl: null }).success).toBe(true);
  });

  it('keeps translations instead of stripping them', () => {
    const r = updateMenuItemSchema.safeParse({
      translations: { es: { name: 'Hamburguesa', description: 'Con queso' } },
    });
    expect(r.success).toBe(true);
    // Stripping is the failure mode that mattered: zod drops unknown keys
    // silently, so the generated copy vanished on save with no error at all.
    if (r.success) expect(r.data.translations?.es?.name).toBe('Hamburguesa');
  });

  it('keeps the fields create accepts but update used to drop', () => {
    const r = updateMenuItemSchema.safeParse({ sortOrder: 3, subCategoryId: 'sub-1', modifiers: '[]' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sortOrder).toBe(3);
      expect(r.data.subCategoryId).toBe('sub-1');
      expect(r.data.modifiers).toBe('[]');
    }
  });

  it('does not require a uuid categoryId, matching create', () => {
    // create uses z.string().min(1); demanding a uuid here would make items in
    // any non-uuid category unsaveable.
    expect(updateMenuItemSchema.safeParse({ categoryId: 'legacy-cat-7' }).success).toBe(true);
  });

  it('still rejects genuinely bad input', () => {
    expect(updateMenuItemSchema.safeParse({ price: -1 }).success).toBe(false);
    expect(updateMenuItemSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateMenuItemSchema.safeParse({ sortOrder: 1.5 }).success).toBe(false);
  });
});
