import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";
import { ModelsList } from "@/components/ModelsList";
import { ResourceDetails } from "@/components/ResourceDetails";
import { ProjectsList } from "@/components/ProjectsList";
import { CascadingDropdowns } from "@/components/CascadingDropdowns";
import { ComparisonResults } from "@/components/ComparisonResults";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileCheck, LogOut, Brain, FileText, Download, Upload, GitCompare } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { getFieldMapping } from "@/config/fieldMappings";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [selectedInputs, setSelectedInputs] = useState<{ column: string; value: string }[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [customModels, setCustomModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState<string>("");
  const [apiVersion, setApiVersion] = useState<string>("");
  const [customCount, setCustomCount] = useState<number>(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleFileSelect = (file: File) => {
    setPdfFile(file);
    setAnalysisResults(null);
  };

  const handleExcelFileSelect = async (file: File) => {
    setExcelFile(file);
    
    // Parse Excel file for comparison
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setExcelData(jsonData);
    } catch (error) {
      console.error('Error parsing Excel file:', error);
    }
  };

  const uploadExcelToDatabase = async () => {
    if (!excelFile || !session?.user) {
      toast({
        title: "Missing file or authentication",
        description: "Please upload an Excel file and ensure you're logged in",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Read Excel file
      const arrayBuffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Parse headers and data
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1);

      // Group rows by Communication no. and Product Version no.
      const productMap = new Map<string, any>();

      for (const row of dataRows) {
        const rowData = row as any[];
        if (!rowData || rowData.length === 0) continue;

        const commNo = rowData[0];
        const productVersion = rowData[2];
        const key = `${commNo}-${productVersion}`;

        if (!productMap.has(key)) {
          // Create new product entry
          productMap.set(key, {
            communication_no: rowData[0],
            material: rowData[1],
            product_version_no: rowData[2],
            name_of_dependency: rowData[3],
            finished_goods_material_number: rowData[4],
            super_theme: rowData[5],
            geography: rowData[6],
            ean_upc: rowData[7],
            product_age_classification: rowData[8],
            piece_count_of_fg: rowData[9] ? parseInt(rowData[9]) : null,
            global_launch_date: rowData[10],
            marketing_exit_date: rowData[11],
            components: []
          });
        }

        // Add component if exists
        if (rowData[12]) {
          productMap.get(key).components.push({
            material_group: rowData[12],
            component: rowData[14],
            component_description: rowData[15],
            design_raw_material: rowData[16],
            super_design: rowData[18],
            pack_print_orientation: rowData[19],
            packaging_sublevel: rowData[20],
            bom_quantity: rowData[21]
          });
        }
      }

      // Insert products and components into database
      let productsInserted = 0;
      let componentsInserted = 0;

      for (const [, productData] of productMap) {
        const components = productData.components;
        delete productData.components;

        // Insert product
        const { data: product, error: productError } = await (supabase as any)
          .from('products')
          .insert({
            ...productData,
            user_id: session.user.id
          })
          .select()
          .single() as { data: any; error: any };

        if (productError) {
          console.error('Error inserting product:', productError);
          continue;
        }

        productsInserted++;

        // Insert components
        if (components.length > 0 && product) {
          const componentsWithProductId = components.map((comp: any) => ({
            ...comp,
            product_id: product.id
          }));

          const { error: componentsError } = await (supabase as any)
            .from('product_components')
            .insert(componentsWithProductId);

          if (componentsError) {
            console.error('Error inserting components:', componentsError);
          } else {
            componentsInserted += components.length;
          }
        }
      }

      toast({
        title: "Upload successful",
        description: `Inserted ${productsInserted} products and ${componentsInserted} components`,
      });

      setExcelFile(null);
    } catch (error) {
      console.error('Error uploading Excel data:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process Excel file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadAnalysisCSV = () => {
    if (!analysisResults || !analysisResults.fields) return;

    // Convert fields object to array format for CSV
    const csvData = Object.entries(analysisResults.fields).map(([field, value]) => ({
      Field: field,
      Value: String(value)
    }));

    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analysis Results");

    // Generate CSV file and trigger download
    const fileName = `analysis_${pdfFile?.name.replace('.pdf', '')}_${new Date().toISOString().split('T')[0]}.csv`;
    XLSX.writeFile(workbook, fileName, { bookType: 'csv' });

    toast({
      title: "CSV downloaded",
      description: `Analysis results saved as ${fileName}`,
    });
  };

  const handleSelectedInputsChange = (inputs: { column: string; value: string }[]) => {
    setSelectedInputs(inputs);
  };

  const comparePdfWithSelectedInputs = async () => {
    if (!pdfFile || !selectedModelId || selectedInputs.length === 0) {
      toast({
        title: "Missing Requirements",
        description: "Please upload a PDF, select a model, and check at least one field",
        variant: "destructive",
      });
      return;
    }

    setIsComparing(true);
    
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('selectedInputs', JSON.stringify(selectedInputs));
      formData.append('modelId', selectedModelId);

      const { data, error } = await supabase.functions.invoke('compare-documents', {
        body: formData,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setComparisonResults(data.results);
      
      toast({
        title: "Checking Complete",
        description: `${data.summary.correct} correct, ${data.summary.incorrect} incorrect, ${data.summary.notFound} not found`,
      });
    } catch (error) {
      console.error('Comparison error:', error);
      toast({
        title: "Checking Failed",
        description: error instanceof Error ? error.message : "Failed to check documents",
        variant: "destructive",
      });
      setComparisonResults(null);
    } finally {
      setIsComparing(false);
    }
  };

  const analyzePdf = async () => {
    if (!pdfFile) {
      toast({
        title: "Missing PDF file",
        description: "Please upload a PDF file first",
        variant: "destructive",
      });
      return;
    }

    if (!selectedModelId) {
      toast({
        title: "No model selected",
        description: "Please select a model before analyzing",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResults(null);
    
    try {
      // Create FormData to send PDF to edge function
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('modelId', selectedModelId);

      // Call Azure Document Intelligence via edge function
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysisResults(data);
      
      toast({
        title: "Analysis complete",
        description: `Extracted ${Object.keys(data.fields || {}).length} fields from PDF`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze PDF";
      toast({
        title: "Analysis error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const loadProjects = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-document-models', {
        body: { fetchProjects: true }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const projectsList = data.projects || [];
      setProjects(projectsList);
      
      // Show info about models and projects
      if (data.customModelsCount === 0) {
        toast({
          title: "No custom models found",
          description: `Only prebuilt models detected. Create custom extraction models in Azure Document Intelligence Studio to see projects.`,
          variant: "destructive",
        });
      } else if (projectsList.length === 0) {
        toast({
          title: "No projects found",
          description: `Found ${data.customModelsCount} custom models, but none have project tags. Models need to be tagged with 'projectId' and 'projectName' in Azure.`,
          variant: "destructive",
        });
      } else {
        // Set default project if available
        const defaultProject = projectsList.find((p: any) => p.id === "c8b46fee-55a2-459e-8243-243880c9b9b4");
        setSelectedProjectId(defaultProject?.id || projectsList[0].id);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({
        title: "Error loading projects",
        description: error instanceof Error ? error.message : "Failed to load projects",
        variant: "destructive",
      });
    }
  };

  const loadAllModels = async () => {
    setIsLoadingModels(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-document-models', {
        body: {} // Fetch all models
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data?.customModels) {
        setModels(data.customModels);
        setCustomModels(data.customModels);
        if (data.endpoint) {
          setAzureEndpoint(data.endpoint);
        }
        if (data.apiVersion) {
          setApiVersion(data.apiVersion);
        }
        setCustomCount(data.customCount || 0);
        
        // Auto-select first model if available
        if (data.customModels.length > 0 && !selectedModelId) {
          setSelectedModelId(data.customModels[0].modelId);
        }
        
        toast({
          title: "Custom models loaded",
          description: `Found ${data.customCount || 0} custom extraction models`
        });
      }
    } catch (error) {
      console.error('Error loading models:', error);
      toast({
        title: "Error loading models",
        description: error instanceof Error ? error.message : "Failed to load models",
        variant: "destructive"
      });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const loadModels = async () => {
    if (!selectedProjectId) {
      loadAllModels();
      return;
    }

    setIsLoadingModels(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-document-models', {
        body: { projectId: selectedProjectId }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setModels(data.models || []);
      if (data.endpoint) {
        setAzureEndpoint(data.endpoint);
      }
      if (data.apiVersion) {
        setApiVersion(data.apiVersion);
      }
      
      toast({
        title: "Models loaded",
        description: `Found ${data.models?.length || 0} models for selected project`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load models";
      toast({
        title: "Error loading models",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Error loading models:", error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  if (!session) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-end items-center mb-4">
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <FileCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Document Intelligence Analysis
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your PDF document to extract and analyze data using Azure AI
            </p>
          </div>

          {/* Resource Details */}
          {azureEndpoint && apiVersion && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ResourceDetails
                endpoint={azureEndpoint}
                apiVersion={apiVersion}
                customModels={customCount}
              />
            </div>
          )}

          {/* Model Selection */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex gap-2 items-center justify-center">
              {customModels.length > 0 ? (
                <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                  <SelectTrigger className="w-[400px]">
                    <SelectValue placeholder="Select a custom model" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 max-h-[300px]">
                    {customModels.map((model) => (
                      <SelectItem key={model.modelId} value={model.modelId}>
                        {model.description || model.modelId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={loadModels} disabled={isLoadingModels}>
                {isLoadingModels ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Load Models
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* File Upload Section */}
          <FileUpload
            onFileSelect={handleFileSelect}
            onExcelSelect={handleExcelFileSelect}
            pdfFile={pdfFile}
            excelFile={excelFile}
          />

          {/* Cascading Dropdowns Section */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CascadingDropdowns onSelectedInputsChange={handleSelectedInputsChange} />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              onClick={analyzePdf}
              disabled={!pdfFile || !selectedModelId || isAnalyzing}
              size="lg"
              className="px-8"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Analyze Document
                </>
              )}
            </Button>

            <Button
              onClick={comparePdfWithSelectedInputs}
              disabled={!pdfFile || !selectedModelId || selectedInputs.length === 0 || isComparing}
              size="lg"
              className="px-8"
              variant="default"
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <GitCompare className="w-5 h-5 mr-2" />
                  Check
                </>
              )}
            </Button>

            <Button
              onClick={uploadExcelToDatabase}
              disabled={!excelFile || isUploading}
              size="lg"
              className="px-8"
              variant="secondary"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload to Database
                </>
              )}
            </Button>
          </div>

          {/* Comparison Results */}
          {comparisonResults && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ComparisonResults results={comparisonResults} />
            </div>
          )}

          {/* Analysis Results */}
          {analysisResults && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-card rounded-lg border p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">PDF Analysis Results</h3>
                  <Button onClick={downloadAnalysisCSV} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(analysisResults.fields || {}).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between items-start p-3 bg-muted/50 rounded">
                      <span className="font-medium text-sm">{key}:</span>
                      <span className="text-sm text-muted-foreground ml-4">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Index;
