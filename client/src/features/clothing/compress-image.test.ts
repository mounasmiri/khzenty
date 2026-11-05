import { describe, expect, it } from 'vitest';

import { carriesAlpha, planEncoding, renameFor } from './compress-image';

describe('carriesAlpha', () => {
  it('recognises the alpha-capable containers', () => {
    expect(carriesAlpha('image/png')).toBe(true);
    expect(carriesAlpha('image/webp')).toBe(true);
    expect(carriesAlpha('image/avif')).toBe(true);
  });

  it('treats JPEG as opaque', () => {
    expect(carriesAlpha('image/jpeg')).toBe(false);
    expect(carriesAlpha('image/jpg')).toBe(false);
  });

  it('ignores case, since MIME types arrive however the OS spells them', () => {
    expect(carriesAlpha('IMAGE/PNG')).toBe(true);
    expect(carriesAlpha('Image/WebP')).toBe(true);
  });

  it('says no to anything unrecognised rather than guessing', () => {
    expect(carriesAlpha('')).toBe(false);
    expect(carriesAlpha('image/gif')).toBe(false);
    expect(carriesAlpha('application/pdf')).toBe(false);
  });
});

describe('planEncoding', () => {
  describe('opaque sources', () => {
    it('re-encodes a large photo as JPEG', () => {
      expect(planEncoding('image/jpeg', true)).toEqual({ skip: false, type: 'image/jpeg' });
    });

    it('still re-encodes a small photo, to shrink the bytes', () => {
      // The caller then keeps whichever file is smaller.
      expect(planEncoding('image/jpeg', false)).toEqual({ skip: false, type: 'image/jpeg' });
    });
  });

  describe('alpha sources', () => {
    it('skips entirely when no resize is needed', () => {
      // The case this exists for: re-running removal on an existing cutout.
      // It is already a 1200px square WebP, so there is nothing to gain and a
      // re-encode would only lose a generation.
      expect(planEncoding('image/webp', false)).toEqual({ skip: true, type: 'image/webp' });
      expect(planEncoding('image/png', false)).toEqual({ skip: true, type: 'image/webp' });
    });

    it('resizes as WebP rather than JPEG when it is too large', () => {
      // A big PNG still needs shrinking, but JPEG would flatten its
      // transparency onto black.
      expect(planEncoding('image/png', true)).toEqual({ skip: false, type: 'image/webp' });
      expect(planEncoding('image/avif', true)).toEqual({ skip: false, type: 'image/webp' });
    });

    it('never plans a JPEG encode for an alpha source', () => {
      for (const type of ['image/png', 'image/webp', 'image/avif']) {
        for (const needsResize of [true, false]) {
          expect(planEncoding(type, needsResize).type).not.toBe('image/jpeg');
        }
      }
    });
  });

  it('covers all four branches distinctly', () => {
    const plans = [
      planEncoding('image/jpeg', true),
      planEncoding('image/jpeg', false),
      planEncoding('image/png', true),
      planEncoding('image/png', false),
    ];

    expect(plans).toEqual([
      { skip: false, type: 'image/jpeg' },
      { skip: false, type: 'image/jpeg' },
      { skip: false, type: 'image/webp' },
      { skip: true, type: 'image/webp' },
    ]);
  });
});

describe('renameFor', () => {
  it('matches the extension to the encoding', () => {
    expect(renameFor('photo.heic', 'image/jpeg')).toBe('photo.jpg');
    expect(renameFor('photo.png', 'image/webp')).toBe('photo.webp');
    expect(renameFor('cutout.webp', 'image/png')).toBe('cutout.png');
  });

  it('copes with a name that has no extension', () => {
    expect(renameFor('stored-photo', 'image/webp')).toBe('stored-photo.webp');
  });

  it('falls back to a name rather than producing a bare extension', () => {
    // A file called ".jpg" leaves nothing behind once the extension is removed.
    expect(renameFor('.jpg', 'image/jpeg')).toBe('photo.jpg');
  });

  it('defaults to jpg for an unknown type instead of inventing an extension', () => {
    expect(renameFor('thing.bin', 'image/tiff')).toBe('thing.jpg');
  });
});
