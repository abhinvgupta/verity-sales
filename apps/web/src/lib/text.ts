/** "brand_recognition" → "Brand recognition". */
export function humanizeObjection(type: string): string {
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
