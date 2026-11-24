// Caseback engraving: what a visitor may type, and how it travels to Shopify as a cart line attribute.
export const MAX_ENGRAVING = 14;

export function cleanEngraving(s) {
  if (typeof s !== 'string') return '';
  const kept = s.toUpperCase().replace(/[^A-Z0-9 .&'-]/g, '').replace(/\s+/g, ' ').trimStart();
  return kept.slice(0, MAX_ENGRAVING).trimEnd();
}

export function engravingAttrs(text) {
  const t = cleanEngraving(text);
  return t ? { Engraving: t } : {};
}
