import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FUNCTION_NAME = "compare-documents";
const FUNCTION_VERSION = "2025-10-26-barcode-fix-v3";
const BUILD_TIME = new Date().toISOString();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log(`[${FUNCTION_NAME}] v${FUNCTION_VERSION} built at ${BUILD_TIME}`);

// LP5 Model Field Mapping (matches src/config/fieldMappings.ts)
const LP5_MAPPING: Record<string, string | string[]> = {
  "Communication no.": ["SKU_Front", "SKU_Left", "SKU_Right", "SKU_Top", "SKU_Bottom", "SKU_Back"],
  "Product Age Classification": "AgeMark",
  "Name of Dependency": "Version",
  "Piece count of FG": "PieceCount",
  Component: ["Material Number_Info Box", "MaterialBottom", "MaterialSide"],
  "Finished Goods Material Number": "ItemNumber",
  "EAN/UPC": ["Barcode", "UPCA", "DataMatrix"],
};

// Model_PKG_v2_Combined Field Mapping
const MODEL_PKG_V2_COMBINED_MAPPING: Record<string, string | string[]> = {
  "Communication no.": [
    "SKU_Number_Front",
    "SKU_Number_Left",
    "SKU_Number_Right",
    "SKU_Number_Top",
    "SKU_Number_Bottom",
    "SKU_Number_Back",
  ],
  "Product Age Classification": "Age_Mark",
  "Name of Dependency": "Version",
  "Piece count of FG": "Piece_Count",
  Component: ["Material_Number_MA", "Material_Number_Bottom", "Material_Number_SA_Flap"],
  "Finished Goods Material Number": "Item_Number",
  "EAN/UPC": ["Barcode", "UPCA", "DataMatrix"],
  "Super Design": "Super_Design",
};

// Mapping registry to select correct mapping based on modelId
const MAPPING_REGISTRY: Record<string, Record<string, string | string[]>> = {
  LP5: LP5_MAPPING,
  Model_PKG_v2_Combined: MODEL_PKG_V2_COMBINED_MAPPING,
};

const SPECIAL_RULES: Record<string, { removeSpaces?: boolean; toLowerCase?: boolean }> = {
  Barcode: { removeSpaces: true },
  UPCA: { removeSpaces: true },
  DataMatrix: { removeSpaces: true },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request returns version info
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        name: FUNCTION_NAME,
        version: FUNCTION_VERSION,
        buildTime: BUILD_TIME,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File;
    const selectedInputsData = formData.get("selectedInputs") as string;
    const modelId = formData.get("modelId") as string;

    if (!pdfFile || !selectedInputsData) {
      return new Response(JSON.stringify({ error: "Missing PDF file or selected inputs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse selected inputs: [{ column: string, value: string }]
    const selectedInputs = JSON.parse(selectedInputsData);

    if (!modelId) {
      return new Response(JSON.stringify({ error: "No model ID provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const azureKey = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_KEY");
    const azureEndpoint = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT");

    if (!azureKey || !azureEndpoint) {
      return new Response(JSON.stringify({ error: "Azure credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting document analysis with model: ${modelId}...`);

    // Convert file to array buffer
    const pdfBuffer = await pdfFile.arrayBuffer();

    // Start document analysis with the selected custom model
    const analyzeUrl = `${azureEndpoint}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31&features=barcodes&features=ocrHighResolution`;

    const analyzeResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": "application/pdf",
      },
      body: pdfBuffer,
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error("Azure API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to analyze document", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the operation location to poll for results
    const operationLocation = analyzeResponse.headers.get("Operation-Location");
    if (!operationLocation) {
      return new Response(JSON.stringify({ error: "No operation location returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Polling for results...");

    // Poll for results
    let analysisResult;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between polls

      const resultResponse = await fetch(operationLocation, {
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
        },
      });

      const result = await resultResponse.json();

      if (result.status === "succeeded") {
        analysisResult = result.analyzeResult;
        break;
      } else if (result.status === "failed") {
        return new Response(JSON.stringify({ error: "Document analysis failed", details: result }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      attempts++;
    }

    if (!analysisResult) {
      return new Response(JSON.stringify({ error: "Analysis timed out" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Analysis complete, extracting data with original field names...");

    // Extract data from PDF preserving original field names (not lowercased)
    const pdfData: Record<string, string> = {};

    // Extract from document fields
    if (analysisResult.documents && analysisResult.documents[0]) {
      const doc = analysisResult.documents[0];
      for (const [fieldName, fieldValue] of Object.entries(doc.fields || {})) {
        if (!fieldValue) continue;
        const fv: any = fieldValue;

        // Prefer valueString, fallback to content, then numeric types
        let extracted: string | undefined = undefined;
        if (fv.valueString !== undefined && fv.valueString !== null) {
          extracted = String(fv.valueString).trim();
        } else if (fv.content !== undefined && fv.content !== null) {
          extracted = String(fv.content).trim();
        } else if (fv.valueNumber !== undefined && fv.valueNumber !== null) {
          extracted = String(fv.valueNumber);
        } else if (fv.valueInteger !== undefined && fv.valueInteger !== null) {
          extracted = String(fv.valueInteger);
        }

        if (extracted && extracted !== "") {
          // Remove spaces from barcode-related fields
          if (fieldName === 'Barcode' || fieldName === 'UPCA' || fieldName === 'DataMatrix') {
            pdfData[fieldName] = extracted.replace(/\s+/g, '');
          } else {
            pdfData[fieldName] = extracted;
          }
        }
      }
      
      // Debug: Log barcode-related fields after extraction
      console.log('Doc fields snapshot:', {
        UPCA: pdfData['UPCA'],
        DataMatrix: pdfData['DataMatrix'],
        Barcode: pdfData['Barcode'],
      });
    }

    // Extract from keyValuePairs with original keys
    if (analysisResult.keyValuePairs) {
      for (const kvp of analysisResult.keyValuePairs) {
        if (kvp.key && kvp.value) {
          const keyText = kvp.key.content || "";
          const valueText = kvp.value.content || "";
          pdfData[keyText.trim()] = valueText.trim();
        }
      }
    }

    // Extract from tables if present
    if (analysisResult.tables) {
      for (const table of analysisResult.tables) {
        for (const cell of table.cells) {
          if (cell.content) {
            pdfData[`table_${cell.rowIndex}_${cell.columnIndex}`] = cell.content;
          }
        }
      }
    }

    // Extract barcodes from pages
    if (analysisResult.pages) {
      console.log('Processing barcodes from pages...');
      
      for (const page of analysisResult.pages) {
        if (page.barcodes && page.barcodes.length > 0) {
          for (const barcode of page.barcodes) {
            const kind = barcode.kind || '';  // Keep original casing
            const kindNormalized = kind.toLowerCase().replace(/[-_\s]/g, '');
            const value = barcode.value;
            
            // Extract UPCA barcode (handles: UPCA, upca, Upca, UPC-A, upc_a, etc.)
            if (kindNormalized === 'upca' && value) {
              pdfData['UPCA'] = value.replace(/\s+/g, '');  // Remove all spaces
              console.log(`Found UPCA barcode (kind: ${barcode.kind}): ${value}`);
            }
            
            // Extract DataMatrix barcode (handles: DataMatrix, datamatrix, data-matrix, etc.)
            if (kindNormalized === 'datamatrix' && value) {
              pdfData['DataMatrix'] = value.replace(/\s+/g, '');  // Remove all spaces
              console.log(`Found DataMatrix barcode (kind: ${barcode.kind}): ${value}`);
            }
          }
        }
      }
      
      console.log(`Barcode extraction complete - UPCA: ${pdfData['UPCA'] || 'N/A'}, DataMatrix: ${pdfData['DataMatrix'] || 'N/A'}`);
      
      // Debug: Log all barcode kinds found in the document
      const allKinds = analysisResult.pages
        .flatMap((page: any) => page.barcodes || [])
        .map((b: any) => b.kind)
        .filter(Boolean);
      if (allKinds.length > 0) {
        console.log(`All barcode kinds found in document: ${JSON.stringify(allKinds)}`);
      }
    }

    console.log(`Extracted ${Object.keys(pdfData).length} fields from PDF`);
    console.log("Comparing with selected inputs using field mappings...");

    // Debug: Log EAN/UPC related data before comparison
    const eanUpcInput = selectedInputs.find((si: any) => si.column === 'EAN/UPC');
    if (eanUpcInput) {
      console.log('EAN/UPC Excel input:', eanUpcInput);
      console.log('EAN/UPC mapping:', MAPPING_REGISTRY[modelId]?.['EAN/UPC'] || MODEL_PKG_V2_COMBINED_MAPPING['EAN/UPC']);
      console.log('Barcode pdfData values:', {
        Barcode: pdfData['Barcode'],
        UPCA: pdfData['UPCA'],
        DataMatrix: pdfData['DataMatrix'],
      });
    }

    // Compare PDF data with selected inputs using field mappings
    const comparisonResults = [];

    for (const { column: excelColumnName, value: excelValue } of selectedInputs) {
      // Select the correct mapping based on the model ID (defaults to Model_PKG_v2_Combined)
      const currentMapping = MAPPING_REGISTRY[modelId] || MODEL_PKG_V2_COMBINED_MAPPING;
      // Get the mapped PDF field(s) for this Excel column
      const mappedPdfFields = currentMapping[excelColumnName];

      if (!mappedPdfFields) {
        // No mapping defined - this is a "not found" case
        comparisonResults.push({
          field: excelColumnName,
          pdfValue: "",
          excelValue: String(excelValue),
          status: "not-found",
          matchDetails: "",
        });
        continue;
      }

      // Handle single field mapping
      if (typeof mappedPdfFields === "string") {
        const pdfFieldId = mappedPdfFields;
        let pdfValue = pdfData[pdfFieldId];
        let excelValueStr = String(excelValue);

        if (!pdfValue) {
          comparisonResults.push({
            field: excelColumnName,
            pdfValue: "Not found in PDF",
            excelValue: excelValueStr,
            status: "not-found",
            matchDetails: `Expected Label: ${pdfFieldId}`,
          });
          continue;
        }

        // Apply special rules if defined
        const specialRule = SPECIAL_RULES[pdfFieldId];
        if (specialRule?.removeSpaces) {
          pdfValue = pdfValue.replace(/\s+/g, "");
          excelValueStr = excelValueStr.replace(/\s+/g, "");
        }

        // Compare
        const match = pdfValue.toLowerCase() === excelValueStr.toLowerCase();
        comparisonResults.push({
          field: excelColumnName,
          pdfValue: pdfData[pdfFieldId], // Original value for display
          excelValue: String(excelValue),
          status: match ? "correct" : "incorrect",
        });
      }
      // Handle array mapping (one Excel column maps to multiple PDF fields)
      // Create separate rows for each PDF field
      else if (Array.isArray(mappedPdfFields)) {
        // Debug logging for EAN/UPC specifically
        if (excelColumnName === 'EAN/UPC') {
          console.log(`Processing EAN/UPC comparison - mappedPdfFields: ${mappedPdfFields.join(', ')}`);
        }

        for (const pdfFieldId of mappedPdfFields) {
          const pdfValue = pdfData[pdfFieldId];
          const excelValueStr = String(excelValue);

          // Debug logging for each EAN/UPC subfield
          if (excelColumnName === 'EAN/UPC') {
            console.log(`  Checking ${pdfFieldId}: pdfValue='${pdfValue}', excelValue='${excelValueStr}'`);
          }

          // Skip creating rows for barcode fields that don't exist in the PDF
          // (different PDFs may have different barcode types)
          if (!pdfValue || pdfValue.trim() === '' || pdfValue.trim().toUpperCase() === 'NA') {
            if (excelColumnName === 'EAN/UPC') {
              console.log(`  → ${pdfFieldId} not present in PDF, skipping (not an error)`);
            }
            continue;
          }

          // Apply special rules if needed (remove spaces for all barcode types)
          let normalizedPdfValue = pdfValue;
          let normalizedExcelValue = excelValueStr;

          const specialRule = SPECIAL_RULES[pdfFieldId];
          if (specialRule?.removeSpaces) {
            normalizedPdfValue = normalizedPdfValue.replace(/\s+/g, "");
            normalizedExcelValue = normalizedExcelValue.replace(/\s+/g, "");
          }

          // Compare individual values
          const match = normalizedPdfValue.toLowerCase() === normalizedExcelValue.toLowerCase();

          if (excelColumnName === 'EAN/UPC') {
            console.log(`  → ${pdfFieldId} comparison: match=${match}, status='${match ? "correct" : "incorrect"}'`);
          }

          comparisonResults.push({
            field: `${excelColumnName} (${pdfFieldId})`,
            pdfValue: pdfValue, // Original value for display
            excelValue: excelValueStr,
            status: match ? "correct" : "incorrect",
          });
        }
      }
    }

    const summary = {
      total: comparisonResults.length,
      correct: comparisonResults.filter((r) => r.status === "correct").length,
      incorrect: comparisonResults.filter((r) => r.status === "incorrect").length,
      notFound: comparisonResults.filter((r) => r.status === "not-found").length,
    };

    console.log(
      `Comparison complete: ${summary.correct} correct, ${summary.incorrect} incorrect, ${summary.notFound} not found`,
    );

    return new Response(
      JSON.stringify({
        results: comparisonResults,
        summary,
        version: {
          name: FUNCTION_NAME,
          version: FUNCTION_VERSION,
          buildTime: BUILD_TIME,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in compare-documents function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
