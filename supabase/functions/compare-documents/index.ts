import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LP5 Model Field Mapping (matches src/config/fieldMappings.ts)
const LP5_MAPPING: Record<string, string | string[]> = {
  "Communication no.": ["SKU_Front", "SKU_Left", "SKU_Right", "SKU_Top", "SKU_Bottom", "SKU_Back"],
  "Product Age Classification": "AgeMark",
  "Product Version no.": "Version",
  "Piece count of FG": "PieceCount",
  "Component": ["Material Number_Info Box", "MaterialBottom", "MaterialSide"],
  "Finished Goods Material Number": "ItemNumber",
  "EAN/UPC": "BarcodeString"
};

const SPECIAL_RULES: Record<string, { removeSpaces?: boolean; toLowerCase?: boolean }> = {
  "BarcodeString": { removeSpaces: true }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const selectedInputsData = formData.get('selectedInputs') as string;
    const modelId = formData.get('modelId') as string;

    if (!pdfFile || !selectedInputsData) {
      return new Response(
        JSON.stringify({ error: 'Missing PDF file or selected inputs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse selected inputs: [{ column: string, value: string }]
    const selectedInputs = JSON.parse(selectedInputsData);

    if (!modelId) {
      return new Response(
        JSON.stringify({ error: 'No model ID provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const azureKey = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY');
    const azureEndpoint = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');

    if (!azureKey || !azureEndpoint) {
      return new Response(
        JSON.stringify({ error: 'Azure credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting document analysis with model: ${modelId}...`);

    // Convert file to array buffer
    const pdfBuffer = await pdfFile.arrayBuffer();

    // Start document analysis with the selected custom model
    const analyzeUrl = `${azureEndpoint}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31`;
    
    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/pdf',
      },
      body: pdfBuffer,
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error('Azure API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze document', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the operation location to poll for results
    const operationLocation = analyzeResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      return new Response(
        JSON.stringify({ error: 'No operation location returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Polling for results...');

    // Poll for results
    let analysisResult;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
      
      const resultResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
        },
      });

      const result = await resultResponse.json();
      
      if (result.status === 'succeeded') {
        analysisResult = result.analyzeResult;
        break;
      } else if (result.status === 'failed') {
        return new Response(
          JSON.stringify({ error: 'Document analysis failed', details: result }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      attempts++;
    }

    if (!analysisResult) {
      return new Response(
        JSON.stringify({ error: 'Analysis timed out' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analysis complete, extracting data with original field names...');

    // Extract data from PDF preserving original field names (not lowercased)
    const pdfData: Record<string, string> = {};
    
    // Extract from document fields
    if (analysisResult.documents && analysisResult.documents[0]) {
      const doc = analysisResult.documents[0];
      for (const [fieldName, fieldValue] of Object.entries(doc.fields || {})) {
        if (fieldValue && (fieldValue as any).content !== undefined) {
          pdfData[fieldName] = String((fieldValue as any).content).trim();
        }
      }
    }

    // Extract from keyValuePairs with original keys
    if (analysisResult.keyValuePairs) {
      for (const kvp of analysisResult.keyValuePairs) {
        if (kvp.key && kvp.value) {
          const keyText = kvp.key.content || '';
          const valueText = kvp.value.content || '';
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

    console.log(`Extracted ${Object.keys(pdfData).length} fields from PDF`);
    console.log('Comparing with selected inputs using field mappings...');

    // Compare PDF data with selected inputs using field mappings
    const comparisonResults = [];
    
    for (const { column: excelColumnName, value: excelValue } of selectedInputs) {
      // Get the mapped PDF field(s) for this Excel column
      const mappedPdfFields = LP5_MAPPING[excelColumnName];
      
      if (!mappedPdfFields) {
        // No mapping defined - this is a "not found" case
        comparisonResults.push({
          field: excelColumnName,
          pdfValue: 'Not found',
          excelValue: String(excelValue),
          status: 'not-found',
          matchDetails: 'No mapping configured for this field'
        });
        continue;
      }
      
      // Handle single field mapping
      if (typeof mappedPdfFields === 'string') {
        const pdfFieldId = mappedPdfFields;
        let pdfValue = pdfData[pdfFieldId];
        let excelValueStr = String(excelValue);
        
        if (!pdfValue) {
          comparisonResults.push({
            field: excelColumnName,
            pdfValue: 'Not found in PDF',
            excelValue: excelValueStr,
            status: 'not-found',
            matchDetails: `Expected PDF field: ${pdfFieldId}`
          });
          continue;
        }
        
        // Apply special rules if defined
        const specialRule = SPECIAL_RULES[pdfFieldId];
        if (specialRule?.removeSpaces) {
          pdfValue = pdfValue.replace(/\s+/g, '');
          excelValueStr = excelValueStr.replace(/\s+/g, '');
        }
        
        // Compare
        const match = pdfValue.toLowerCase() === excelValueStr.toLowerCase();
        comparisonResults.push({
          field: excelColumnName,
          pdfValue: pdfData[pdfFieldId], // Original value for display
          excelValue: String(excelValue),
          status: match ? 'correct' : 'incorrect'
        });
        
      } 
      // Handle array mapping (one Excel column maps to multiple PDF fields)
      // Create separate rows for each PDF field
      else if (Array.isArray(mappedPdfFields)) {
        for (const pdfFieldId of mappedPdfFields) {
          const pdfValue = pdfData[pdfFieldId];
          const excelValueStr = String(excelValue);
          
          if (!pdfValue) {
            comparisonResults.push({
              field: `${excelColumnName} (${pdfFieldId})`,
              pdfValue: 'Not found in PDF',
              excelValue: excelValueStr,
              status: 'not-found',
              matchDetails: `Expected PDF field: ${pdfFieldId}`
            });
          } else {
            // Apply special rules if needed
            let normalizedPdfValue = pdfValue;
            let normalizedExcelValue = excelValueStr;
            
            const specialRule = SPECIAL_RULES[pdfFieldId];
            if (specialRule?.removeSpaces) {
              normalizedPdfValue = normalizedPdfValue.replace(/\s+/g, '');
              normalizedExcelValue = normalizedExcelValue.replace(/\s+/g, '');
            }
            
            // Compare individual values
            const match = normalizedPdfValue.toLowerCase() === normalizedExcelValue.toLowerCase();
            
            comparisonResults.push({
              field: `${excelColumnName} (${pdfFieldId})`,
              pdfValue: pdfValue, // Original value for display
              excelValue: excelValueStr,
              status: match ? 'correct' : 'incorrect'
            });
          }
        }
      }
    }

    const summary = {
      total: comparisonResults.length,
      correct: comparisonResults.filter(r => r.status === 'correct').length,
      incorrect: comparisonResults.filter(r => r.status === 'incorrect').length,
      notFound: comparisonResults.filter(r => r.status === 'not-found').length
    };

    console.log(`Comparison complete: ${summary.correct} correct, ${summary.incorrect} incorrect, ${summary.notFound} not found`);

    return new Response(
      JSON.stringify({ 
        results: comparisonResults,
        summary
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-documents function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
