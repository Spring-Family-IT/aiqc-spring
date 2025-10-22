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
    "Piece count of FG": "PieceCount",
    Component: ["Material Number_Info Box", "MaterialBottom", "MaterialSide"],
    "Finished Goods Material Number": "ItemNumber",
    "EAN/UPC": "BarcodeString",
  },
  specialRules: {
    BarcodeString: {
      removeSpaces: true,
    },
  },
};

// Model_PKG_v2_Combined Field Mapping Configuration (Default)
export const MODEL_PKG_V2_COMBINED_MAPPING: FieldMappingConfig = {
  modelId: "Model_PKG_v2_Combined",
  mappings: {
    "Communication no.": ["SKU_Number_Front", "SKU_Number_Left", "SKU_Number_Right", "SKU_Number_Top", "SKU_Number_Bottom", "SKU_Number_Back"],
    "Product Age Classification": "Age_Mark",
    "Product Version no.": "Version",
    "Piece count of FG": "Piece_Count",
    Component: ["Material_Number_MA", "Material_Number_Bottom", "Material_Number_SA_Flap"],
    "Finished Goods Material Number": "Item_Number",
    "EAN/UPC": "Barcode",
  },
  specialRules: {
    Barcode: {
      removeSpaces: true,
    },
  },
};

// Registry of all model mappings
export const FIELD_MAPPING_REGISTRY: Record<string, FieldMappingConfig> = {
  LP5: LP5_FIELD_MAPPING,
  Model_PKG_v2_Combined: MODEL_PKG_V2_COMBINED_MAPPING,
  // Future models can be added here
};

// Helper function to get mapping for a model (defaults to Model_PKG_v2_Combined)
export function getFieldMapping(modelId: string): FieldMappingConfig {
  return FIELD_MAPPING_REGISTRY[modelId] || MODEL_PKG_V2_COMBINED_MAPPING;
}
