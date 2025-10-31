export interface ParsedPdfFilename {
  sku: string;
  version: string;
  descriptionType: 'MA-BOX' | 'SEMI';
}

export const parsePdfFilename = (filename: string): ParsedPdfFilename | null => {
  // Remove .pdf extension if present
  const nameWithoutExt = filename.replace(/\.pdf$/i, '');
  
  // Split by underscore
  const parts = nameWithoutExt.split('_');
  
  // Must have more than 3 elements (0: SKU, 1: Version, 2: Type, 3+: other)
  if (parts.length <= 3) {
    return null;
  }
  
  const sku = parts[0];
  const version = parts[1];
  const typeElement = parts[2].toUpperCase();
  
  // Determine description type
  let descriptionType: 'MA-BOX' | 'SEMI' | null = null;
  if (typeElement === 'MA') {
    descriptionType = 'MA-BOX';
  } else if (typeElement === 'SA') {
    descriptionType = 'SEMI';
  }
  
  // If description type not recognized, return null
  if (!descriptionType) {
    return null;
  }
  
  return {
    sku,
    version,
    descriptionType
  };
};
