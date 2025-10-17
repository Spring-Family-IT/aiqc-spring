export interface FieldMapping {
  [excelColumn: string]: string | string[];
}

export interface SpecialRules {
  [pdfFieldId: string]: {
    removeSpaces?: boolean;
    toLowerCase?: boolean;
  };
}

export interface FieldMappingConfig {
  modelId: string;
  mappings: FieldMapping;
  specialRules?: SpecialRules;
}

// LP5 Model Field Mapping Configuration
export const LP5_FIELD_MAPPING: FieldMappingConfig = {
  modelId: "LP5",
  mappings: {
    "Communication no.": ["SKU_Front", "SKU_Left", "SKU_Right", "SKU_Top", "SKU_Bottom", "SKU_Back"],
    "Product Age Classification": "AgeMark",
    "Product Version no.": "Version",
    "Piece count of FG": "Piece count",
    "Component": ["Material Number_Info Box", "MaterialBottom", "MaterialSide"],
    "Finished Goods Material Number": "ItemNumber",
    "EAN/UPC": "BarCodeString"
  },
  specialRules: {
    "BarCodeString": {
      removeSpaces: true
    }
  }
};

// Registry of all model mappings
export const FIELD_MAPPING_REGISTRY: Record<string, FieldMappingConfig> = {
  "LP5": LP5_FIELD_MAPPING,
  // Future models can be added here
};

// Helper function to get mapping for a model
export function getFieldMapping(modelId: string): FieldMappingConfig | null {
  return FIELD_MAPPING_REGISTRY[modelId] || null;
}
