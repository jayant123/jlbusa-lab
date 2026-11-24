import { describe, expect, it } from 'vitest';
import { cleanEngraving, engravingAttrs, MAX_ENGRAVING } from '../../src/ostrel/engraving.js';

describe('engraving', () => {
  it('uppercases and keeps letters, digits, spaces and . & - \'', () => {
    expect(cleanEngraving("j.s. & m-k o'neil")).toBe("J.S. & M-K O'NEIL".slice(0, MAX_ENGRAVING));
  });
  it('drops anything else and collapses spaces', () => {
    expect(cleanEngraving('  a<b>c   d😀e ')).toBe('ABC DE');
  });
  it('caps the length at 14 characters', () => {
    expect(MAX_ENGRAVING).toBe(14);
    expect(cleanEngraving('ABCDEFGHIJKLMNOPQRS')).toBe('ABCDEFGHIJKLMN');
  });
  it('handles empty and non-string input', () => {
    expect(cleanEngraving('')).toBe('');
    expect(cleanEngraving(undefined)).toBe('');
    expect(cleanEngraving('   ')).toBe('');
  });
  it('becomes a Shopify line attribute only when there is text', () => {
    expect(engravingAttrs('')).toEqual({});
    expect(engravingAttrs('J.S.')).toEqual({ Engraving: 'J.S.' });
  });
});
