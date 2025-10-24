// Client-side barcode field normalization utility
// Ensures legacy keys (Barcodes_barcode, Barcodes_datamatrix) are converted to canonical names (UPCA, DataMatrix)

export function normalizeBarcodeFields(fields: Record<string, any>): Record<string, any> {
  if (!fields || typeof fields !== 'object') return fields;

  const normalized = { ...fields };

  // Define legacy key mappings (case-insensitive)
  const legacyMappings: Array<{ patterns: string[]; canonical: 'UPCA' | 'DataMatrix' }> = [
    {
      patterns: ['Barcodes_barcode', 'barcodes_barcode', 'Barcode', 'barcode'],
      canonical: 'UPCA',
    },
    {
      patterns: ['Barcodes_datamatrix', 'barcodes_datamatrix', 'DataMatrix', 'datamatrix'],
      canonical: 'DataMatrix',
    },
  ];

  for (const { patterns, canonical } of legacyMappings) {
    for (const pattern of patterns) {
      // Find the key in the object (case-insensitive search)
      const foundKey = Object.keys(normalized).find(
        (k) => k.toLowerCase() === pattern.toLowerCase()
      );

      if (foundKey && foundKey !== canonical) {
        const value = normalized[foundKey];
        
        // Only move if the canonical key is missing or empty/NA
        if (!normalized[canonical] || normalized[canonical] === 'NA' || normalized[canonical] === '') {
          if (value && value !== 'NA' && value !== '') {
            normalized[canonical] = value;
          }
        }

        // Remove the legacy key
        delete normalized[foundKey];
      }
    }
  }

  return normalized;
}
