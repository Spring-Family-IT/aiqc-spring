// Client-side barcode field normalization utility
// Ensures legacy keys (Barcodes_barcode, Barcodes_datamatrix) are converted to canonical names (UPCA, DataMatrix)

export function normalizeBarcodeFields(fields: Record<string, any>): Record<string, any> {
  if (!fields || typeof fields !== 'object') return fields;

  const normalized = { ...fields };

  // First, normalize case for barcode fields (barcode -> Barcode, upca -> UPCA, datamatrix -> DataMatrix)
  const caseNormalizations: Array<{ lowercase: string; canonical: string }> = [
    { lowercase: 'barcode', canonical: 'Barcode' },
    { lowercase: 'upca', canonical: 'UPCA' },
    { lowercase: 'datamatrix', canonical: 'DataMatrix' },
  ];

  for (const { lowercase, canonical } of caseNormalizations) {
    const foundKey = Object.keys(normalized).find(
      (k) => k.toLowerCase() === lowercase && k !== canonical
    );

    if (foundKey) {
      const value = normalized[foundKey];
      
      // Only move if canonical key doesn't exist or is empty/NA
      if (!normalized[canonical] || normalized[canonical] === 'NA' || normalized[canonical] === '') {
        if (value && value !== 'NA' && value !== '') {
          normalized[canonical] = value;
        }
      }
      
      delete normalized[foundKey];
    }
  }

  // Define legacy key mappings - ONLY for underscore-prefixed legacy keys
  const legacyMappings: Array<{ patterns: string[]; canonical: 'UPCA' | 'DataMatrix' }> = [
    {
      patterns: ['Barcodes_barcode', 'barcodes_barcode'],
      canonical: 'UPCA',
    },
    {
      patterns: ['Barcodes_datamatrix', 'barcodes_datamatrix'],
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

  // Trim spaces from barcode values (safety net, server already does this)
  for (const field of ['Barcode', 'UPCA', 'DataMatrix']) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      normalized[field] = normalized[field].replace(/\s+/g, '');
    }
  }

  return normalized;
}
