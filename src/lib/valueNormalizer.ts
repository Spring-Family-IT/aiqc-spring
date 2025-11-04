/**
 * Normalize Excel field values before comparison
 * Ensures consistent formatting between single and batch PDF processing
 */
export const normalizeFieldValue = (column: string, value: string): string => {
  // For Piece Count field, append " pcs/pzs" if not already present
  if (column === 'Piece count of FG') {
    const trimmedValue = value.trim();
    if (!trimmedValue.endsWith(' pcs/pzs')) {
      return `${trimmedValue} pcs/pzs`;
    }
  }
  return value;
};
