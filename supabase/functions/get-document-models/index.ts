import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FUNCTION_NAME = "get-document-models";
const FUNCTION_VERSION = "2025-10-24-v1";
const BUILD_TIME = new Date().toISOString();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log(`[${FUNCTION_NAME}] v${FUNCTION_VERSION} built at ${BUILD_TIME}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('null', { headers: corsHeaders });
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
    const { projectId, fetchProjects } = await req.json().catch(() => ({}));
    
    const azureKey = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY');
    const azureEndpoint = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
    const apiVersion = '2024-02-29';

    if (!azureKey || !azureEndpoint) {
      return new Response(
        JSON.stringify({ error: 'Azure credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching document models from Azure using DocumentIntelligenceAdministrationClient...', projectId ? `for project: ${projectId}` : fetchProjects ? 'fetching all projects' : '');

    // Use the Administration API endpoint with proper version
    const adminApiVersion = '2024-02-29-preview';
    const modelsUrl = `${azureEndpoint}/documentintelligence/documentModels?api-version=${adminApiVersion}`;
    
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure Administration API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch models from Administration API', 
          status: response.status,
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const modelsList = data.value || [];
    console.log(`Successfully fetched ${modelsList.length} models using Administration API`);
    
    // Log first few models to debug
    if (modelsList.length > 0) {
      console.log('Sample models:', JSON.stringify(modelsList.slice(0, 3).map((m: any) => ({
        modelId: m.modelId,
        description: m.description,
        tags: m.tags
      })), null, 2));
    }

    // Categorize models
    const allModels = modelsList.map((model: any) => ({
      ...model,
      isPrebuilt: model.modelId.startsWith('prebuilt-'),
      isCustom: !model.modelId.startsWith('prebuilt-')
    }));
    
    const customModels = allModels.filter((model: any) => model.isCustom);
    const prebuiltModels = allModels.filter((model: any) => model.isPrebuilt);
    
    console.log(`Total models: ${allModels.length}, Custom: ${customModels.length}, Prebuilt: ${prebuiltModels.length}`);
    
    // If no projectId or fetchProjects flag, return all models
    if (!projectId && !fetchProjects) {
      console.log(`Returning all ${allModels.length} models`);
      return new Response(
        JSON.stringify({ 
          allModels,
          customModels,
          prebuiltModels,
          totalCount: allModels.length,
          customCount: customModels.length,
          prebuiltCount: prebuiltModels.length,
          endpoint: azureEndpoint,
          apiVersion: apiVersion,
          version: {
            name: FUNCTION_NAME,
            version: FUNCTION_VERSION,
            buildTime: BUILD_TIME,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log all custom models for debugging
    if (customModels.length > 0) {
      console.log('All custom models:', JSON.stringify(customModels.map((m: any) => ({
        modelId: m.modelId,
        description: m.description,
        tags: m.tags,
        createdDateTime: m.createdDateTime
      })), null, 2));
    } else {
      console.log('No custom models found - only prebuilt models available');
    }
    
    // If fetching projects, extract unique project info from custom models only
    if (fetchProjects) {
      const projectsMap = new Map();
      
      // If no custom models, return empty
      if (customModels.length === 0) {
        console.log('No custom models available to extract projects from');
        return new Response(
          JSON.stringify({ 
            projects: [],
            customModelsCount: 0,
            totalModelsCount: allModels.length,
            message: 'No custom extraction models found. Create custom models in Azure Document Intelligence Studio.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Try to extract projects from tags
      customModels.forEach((model: any) => {
        console.log(`Checking model ${model.modelId} for project tags...`);
        const projectId = model.tags?.projectId || model.tags?.['project-id'];
        const projectName = model.tags?.projectName || model.tags?.['project-name'] || 'Unnamed Project';
        if (projectId) {
          console.log(`  Found project: ${projectId} (${projectName})`);
          projectsMap.set(projectId, { id: projectId, name: projectName });
        } else {
          console.log(`  No project tags found on this model`);
        }
      });
      
      const projects = Array.from(projectsMap.values());
      console.log(`Extracted ${projects.length} unique projects from ${customModels.length} custom models`);
      
      return new Response(
        JSON.stringify({ 
          projects,
          customModelsCount: customModels.length,
          totalModelsCount: allModels.length,
          endpoint: azureEndpoint,
          apiVersion: apiVersion,
          message: projects.length === 0 
            ? 'Custom models exist but have no project tags. Tag your models with "projectId" and "projectName" in Azure.'
            : `Found ${projects.length} projects`,
          version: {
            name: FUNCTION_NAME,
            version: FUNCTION_VERSION,
            buildTime: BUILD_TIME,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Filter by project ID if provided (custom models only)
    let filteredModels = customModels;
    if (projectId) {
      filteredModels = customModels.filter((model: any) => 
        model.tags?.projectId === projectId || 
        model.tags?.['project-id'] === projectId ||
        model.modelId.includes(projectId)
      );
      console.log(`Filtered to ${filteredModels.length} custom models for project ${projectId}`);
    } else {
      console.log(`Returning ${filteredModels.length} custom models`);
    }

    return new Response(
      JSON.stringify({ 
        models: filteredModels,
        customModelsCount: customModels.length,
        totalModelsCount: allModels.length,
        endpoint: azureEndpoint,
        apiVersion: apiVersion,
        version: {
          name: FUNCTION_NAME,
          version: FUNCTION_VERSION,
          buildTime: BUILD_TIME,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-document-models function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
