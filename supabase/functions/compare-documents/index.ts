import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const excelData = JSON.parse(formData.get('excelData') as string);
    const modelId = formData.get('modelId') as string;

    if (!pdfFile || !excelData) {
      return new Response(
        JSON.stringify({ error: 'Missing PDF file or Excel data' }),
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

    console.log('Analysis complete, extracting data...');

    // Extract key-value pairs from the PDF
    const pdfData: Record<string, string> = {};
    
    if (analysisResult.keyValuePairs) {
      for (const kvp of analysisResult.keyValuePairs) {
        if (kvp.key && kvp.value) {
          const keyText = kvp.key.content || '';
          const valueText = kvp.value.content || '';
          pdfData[keyText.toLowerCase().trim()] = valueText.trim();
        }
      }
    }

    // Also extract from tables if present
    if (analysisResult.tables) {
      for (const table of analysisResult.tables) {
        for (const cell of table.cells) {
          if (cell.content) {
            pdfData[`table_${cell.rowIndex}_${cell.columnIndex}`] = cell.content;
          }
        }
      }
    }

    console.log('Comparing with Excel data...');

    // Compare PDF data with Excel data
    const comparisonResults = [];
    
    // Get the first row of Excel data for comparison
    const excelRow = excelData[0] || {};
    
    for (const [excelKey, excelValue] of Object.entries(excelRow)) {
      const normalizedKey = excelKey.toLowerCase().trim();
      const pdfValue = pdfData[normalizedKey] || '';
      const excelValueStr = String(excelValue);
      
      const match = pdfValue.toLowerCase() === excelValueStr.toLowerCase();
      
      comparisonResults.push({
        field: excelKey,
        pdfValue: pdfValue || 'Not found',
        excelValue: excelValueStr,
        match,
      });
    }

    console.log(`Comparison complete: ${comparisonResults.length} fields compared`);

    return new Response(
      JSON.stringify({ results: comparisonResults }),
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
