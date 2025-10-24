import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FUNCTION_NAME = "analyze-document";
const FUNCTION_VERSION = "2025-10-24-normalize-v2";
const BUILD_TIME = new Date().toISOString();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log(`[${FUNCTION_NAME}] v${FUNCTION_VERSION} built at ${BUILD_TIME}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request returns version info
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        name: FUNCTION_NAME,
        version: FUNCTION_VERSION,
        buildTime: BUILD_TIME,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const modelId = formData.get('modelId') as string;

    if (!pdfFile) {
      return new Response(
        JSON.stringify({ error: 'Missing PDF file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    console.log(`Starting PDF analysis with model: ${modelId}...`);

    // Convert file to array buffer
    const pdfBuffer = await pdfFile.arrayBuffer();

    // Start document analysis with the selected custom model
    const analyzeUrl = `${azureEndpoint}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31&features=barcodes&features=ocrHighResolution`;
    
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

    console.log('Analysis complete, extracting fields...');

    // Extract fields from the analysis result
    const extractedFields: Record<string, any> = {};
    
    // Extract from documents
    if (analysisResult.documents && analysisResult.documents.length > 0) {
      const doc = analysisResult.documents[0];
      if (doc.fields) {
        for (const [fieldName, fieldValue] of Object.entries(doc.fields)) {
          const value = (fieldValue as any)?.content || (fieldValue as any)?.valueString || (fieldValue as any)?.valueNumber || 'N/A';
          extractedFields[fieldName] = value;
        }
      }
    }

    // Also extract key-value pairs if available
    if (analysisResult.keyValuePairs) {
      for (const kvp of analysisResult.keyValuePairs) {
        if (kvp.key && kvp.value) {
          const keyText = kvp.key.content || '';
          const valueText = kvp.value.content || '';
          if (!extractedFields[keyText]) {
            extractedFields[keyText] = valueText;
          }
        }
      }
    }

    // Extract barcodes from all pages using actual kind names
    if (analysisResult.pages && analysisResult.pages.length > 0) {
      console.log('Processing barcodes from pages...');
      
      for (const page of analysisResult.pages) {
        if (page.barcodes && page.barcodes.length > 0) {
          for (const barcode of page.barcodes) {
            const kind = barcode.kind || '';
            const kindNormalized = kind.toLowerCase().replace(/[-_\s]/g, '');
            const value = barcode.value;
            
            // Extract UPCA barcode (handles: UPCA, upca, Upca, UPC-A, upc_a, etc.)
            if (kindNormalized === 'upca' && value) {
              extractedFields['UPCA'] = value;
              console.log(`Found UPCA barcode: ${value}`);
            }
            
            // Extract DataMatrix barcode
            if (kindNormalized === 'datamatrix' && value) {
              extractedFields['DataMatrix'] = value;
              console.log(`Found DataMatrix barcode: ${value}`);
            }
          }
        }
      }
    }

    console.log(`Barcode extraction complete - UPCA: ${extractedFields['UPCA'] || 'NA'}, DataMatrix: ${extractedFields['DataMatrix'] || 'NA'}`);

    // Normalize barcode field names - remove legacy keys and ensure canonical names
    const renameMap: Record<string, 'UPCA' | 'DataMatrix'> = {
      'Barcodes_barcode': 'UPCA',
      'Barcodes_datamatrix': 'DataMatrix',
      'barcodes_barcode': 'UPCA',
      'barcodes_datamatrix': 'DataMatrix',
    };

    for (const [oldKey, newKey] of Object.entries(renameMap)) {
      const val = (extractedFields as any)[oldKey];
      if (val && (!extractedFields[newKey] || extractedFields[newKey] === 'NA')) {
        extractedFields[newKey] = val;
      }
      if (oldKey in extractedFields) {
        delete (extractedFields as any)[oldKey];
      }
    }

    console.log('Normalized barcode keys. Final set includes:', {
      UPCA: extractedFields['UPCA'] || 'NA',
      DataMatrix: extractedFields['DataMatrix'] || 'NA',
      totalFields: Object.keys(extractedFields).length,
    });

    return new Response(
      JSON.stringify({ 
        fields: extractedFields,
        modelId: modelId,
        confidence: analysisResult.documents?.[0]?.confidence || 'N/A',
        version: {
          name: FUNCTION_NAME,
          version: FUNCTION_VERSION,
          buildTime: BUILD_TIME,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-document function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
