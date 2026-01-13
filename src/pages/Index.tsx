import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";
import { ModelsList } from "@/components/ModelsList";
import { ResourceDetails } from "@/components/ResourceDetails";
import { ProjectsList } from "@/components/ProjectsList";
import CascadingDropdowns from "@/components/CascadingDropdowns";
import { ComparisonResults } from "@/components/ComparisonResults";
import { BatchComparisonResults } from "@/components/BatchComparisonResults";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileCheck, LogOut, Brain, FileText, Download, Upload, GitCompare, RefreshCw, RotateCcw, AlertCircle, CheckCircle2, ChevronDown, Shield } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Session } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFieldMapping } from "@/config/fieldMappings";
import { normalizeBarcodeFields } from "@/lib/barcodeNormalizer";
import { ExpectedEdgeVersions, FunctionName } from "@/config/edgeVersions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { parsePdfFilename, ParsedPdfFilename } from "@/lib/pdfFilenameParser";
import { processBatchPdfComparison as runBatchComparison } from "@/pages/IndexBatchLogic";
import { useAdmin } from "@/hooks/useAdmin";

// Admin button component
const AdminButton = () => {
  const { isAdmin, loading } = useAdmin();
  const navigate = useNavigate();

  if (loading || !isAdmin) return null;

  return (
    <Button variant="outline" onClick={() => navigate('/admin')}>
      <Shield className="w-4 h-4 mr-2" />
      Admin
    </Button>
  );
};

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
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
  const [backendVersionsOutdated, setBackendVersionsOutdated] = useState<boolean>(false);
  const [backendVersionsChecked, setBackendVersionsChecked] = useState<boolean>(false);
  const [parsedPdfFilenames, setParsedPdfFilenames] = useState<(ParsedPdfFilename | null)[]>([]);
  const modelsLoadedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Control visibility of backend status indicator
  const SHOW_BACKEND_STATUS = false; // Set to true to re-enable
  
  // Control visibility of Azure Resource Details
  const SHOW_AZURE_RESOURCE_DETAILS = false; // Set to true to show endpoint and API version

  // Check backend versions on mount
  useEffect(() => {
    if (SHOW_BACKEND_STATUS) {
      checkBackendVersions();
    }
  }, []);

  const checkBackendVersions = async () => {
    const functionsBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    try {
      const functions: FunctionName[] = ["analyze-document", "compare-documents", "get-document-models", "health-check"];
      let hasOutdated = false;

      for (const fn of functions) {
        try {
          const res = await fetch(`${functionsBase}/${fn}`, {
            method: "GET",
            headers: { "apikey": anonKey },
          });
          
          if (res.ok) {
            const json = await res.json();
            const expected = ExpectedEdgeVersions[fn];
            if (json.version !== expected) {
              hasOutdated = true;
              console.warn(`Function ${fn} version mismatch: expected ${expected}, got ${json.version}`);
            }
          }
        } catch (e) {
          console.warn(`Could not check version for ${fn}:`, e);
        }
      }

      setBackendVersionsOutdated(hasOutdated);
      setBackendVersionsChecked(true);
    } catch (e) {
      console.error("Error checking backend versions:", e);
      setBackendVersionsChecked(true);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
          modelsLoadedRef.current = false;
        } else if (!modelsLoadedRef.current) {
          // Auto-load models only once when session is established
          loadAllModels();
          modelsLoadedRef.current = true;
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else if (!modelsLoadedRef.current) {
        // Auto-load models on initial load only if not already loaded
        loadAllModels();
        modelsLoadedRef.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Clear comparison and analysis results when model changes
  useEffect(() => {
    setComparisonResults(null);
    setAnalysisResults(null);
  }, [selectedModelId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleFileSelect = (files: File[]) => {
    setPdfFiles(files);
    setAnalysisResults(null);
    setComparisonResults(null);
    setBatchResults([]);
    
    // Parse all PDF filenames
    const parsed = files.map(file => parsePdfFilename(file.name));
    setParsedPdfFilenames(parsed);
    
    toast({
      title: "Files selected",
      description: `${files.length} PDF file(s) ready for processing`,
    });
  };

  const handleRemovePdf = (index: number) => {
    const newFiles = pdfFiles.filter((_, i) => i !== index);
    const newParsed = parsedPdfFilenames.filter((_, i) => i !== index);
    setPdfFiles(newFiles);
    setParsedPdfFilenames(newParsed);
    
    if (newFiles.length === 0) {
      setBatchResults([]);
      setComparisonResults(null);
    }
  };

  const handleExcelFileSelect = async (file: File) => {
    setExcelFile(file);
    setComparisonResults(null);
    
    // Parse Excel file using SAP-specific parser
    const { parseSapExcel } = await import('@/lib/parseSapExcel');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { jsonData } = await parseSapExcel(arrayBuffer);
      setExcelData(jsonData);
      
      toast({
        title: "Excel file loaded",
        description: `Loaded ${jsonData.length} rows for batch processing`,
      });
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      toast({
        title: "Error loading Excel",
        description: error instanceof Error ? error.message : "Failed to parse Excel file",
        variant: "destructive",
      });
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

    // Normalize barcode fields before exporting
    const normalizedFields = normalizeBarcodeFields(analysisResults.fields);

    // Convert fields object to array format for CSV
    const csvData = Object.entries(normalizedFields).map(([field, value]) => ({
      Field: field,
      Value: String(value)
    }));

    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analysis Results");

    // Generate CSV file and trigger download
    const fileName = `analysis_${new Date().toISOString().split('T')[0]}.csv`;
    XLSX.writeFile(workbook, fileName, { bookType: 'csv' });

    toast({
      title: "CSV downloaded",
      description: `Analysis results saved as ${fileName}`,
    });
  };

  const downloadComparisonReport = () => {
    if (!comparisonResults || !analysisResults || !session?.user?.email || pdfFiles.length === 0) {
      toast({
        title: "Cannot generate report",
        description: "Missing required data for report generation",
        variant: "destructive"
      });
      return;
    }

    const pdfFile = pdfFiles[0]; // Use first file for single PDF report

    try {
      // 1. Prepare timestamp
      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      // 2. Build the data row
      const reportRow: any = {
        'Timestamp': timestamp,
        'User': session.user.email,
        'File Name': pdfFile.name
      };

    // 3. Add RESULT columns (from comparison results)
    comparisonResults.forEach((result: any) => {
      const status = result.status === 'correct' ? 'MATCHED' : 
                     result.status === 'incorrect' ? 'MISMATCHED' : 
                     'Not Found';
      
      // Extract field name - if it contains parentheses, use only the content inside
      // e.g., "Communication no. (SKU_Number_Front)" -> "SKU_Number_Front"
      let fieldName = result.field;
      const parenMatch = fieldName.match(/\(([^)]+)\)/);
      if (parenMatch) {
        fieldName = parenMatch[1]; // Extract text inside parentheses
      }
      
      reportRow[`RESULT_${fieldName}`] = status;
    });

      // 4. Add SAP columns (from selected inputs / Excel data)
      selectedInputs.forEach((input: any) => {
        reportRow[`${input.column}_SAP`] = input.value;
      });

      // 5. Add PDF Analysis columns (from analysis results - normalized)
      const normalizedFields = normalizeBarcodeFields(analysisResults.fields || {});
      Object.entries(normalizedFields).forEach(([key, value]) => {
        reportRow[key] = String(value);
      });

      // 6. Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet([reportRow]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

      // 7. Apply cell styling
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      // Get column indices
      let resultStartCol = 3; // After Timestamp, User, File Name
      let sapStartCol = resultStartCol + comparisonResults.length;
      let pdfStartCol = sapStartCol + selectedInputs.length;

      // Apply RED color to RESULT columns (headers)
      for (let col = resultStartCol; col < sapStartCol; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        worksheet[cellAddress].s = {
          font: { color: { rgb: "FF0000" }, bold: true }
        };
      }

      // Apply BLUE color to SAP columns (headers)
      for (let col = sapStartCol; col < pdfStartCol; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        worksheet[cellAddress].s = {
          font: { color: { rgb: "0000FF" }, bold: true }
        };
      }

      // Apply BLACK color to PDF columns (headers) - default but make bold
      for (let col = pdfStartCol; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        worksheet[cellAddress].s = {
          font: { color: { rgb: "000000" }, bold: true }
        };
      }

      // 8. Generate filename and download
      const selectedModel = models.find(m => m.modelId === selectedModelId);
      const modelName = selectedModel?.description || selectedModel?.modelId || 'Model';
      const fileName = `Report_${modelName}.xlsx`;
      
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Report downloaded",
        description: `Comparison report saved as ${fileName}`
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Report generation failed",
        description: error instanceof Error ? error.message : "Failed to generate Excel report",
        variant: "destructive"
      });
    }
  };

  const handleSelectedInputsChange = (inputs: { column: string; value: string }[]) => {
    setSelectedInputs(inputs);
  };

  const handlePrimaryKeyChange = () => {
    setComparisonResults(null);
  };

  const comparePdfWithSelectedInputs = async () => {
    if (pdfFiles.length === 0 || !selectedModelId || selectedInputs.length === 0) {
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
      formData.append('pdf', pdfFiles[0]); // Use first file for single comparison
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
        description: `${data.summary.correct} matched, ${data.summary.incorrect} mismatched, ${data.summary.notFound} not found`,
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
    if (pdfFiles.length === 0) {
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
      formData.append('pdf', pdfFiles[0]); // Use first PDF for single analysis
      formData.append('modelId', selectedModelId);

      // Call Azure Document Intelligence via edge function
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        // If there are details from Azure, show them in a more user-friendly way
        let errorMessage = data.error;
        
        if (data.details) {
          try {
            const details = typeof data.details === 'string' ? JSON.parse(data.details) : data.details;
            if (details.error) {
              // Extract specific error from Azure response
              const azureError = details.error;
              errorMessage = `${data.error}: ${azureError.message || 'Unknown Azure error'}`;
              
              // If there's an inner error with more details, include it
              if (azureError.innererror?.message) {
                errorMessage += ` (${azureError.innererror.message})`;
              }
            }
          } catch (e) {
            // If parsing fails, just use details as string
            errorMessage = `${data.error}: ${data.details}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Normalize barcode fields before setting results
      if (data.fields) {
        data.fields = normalizeBarcodeFields(data.fields);
      }

      setAnalysisResults(data);
      
      toast({
        title: "Analysis complete",
        description: `Extracted ${Object.keys(data.fields || {}).length} fields from PDF`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze PDF";
      toast({
        title: "Analysis Failed",
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
        
        // Auto-select "Model_PKG_v2_Combined" model by default
        if (data.customModels.length > 0) {
          const defaultModel = data.customModels.find(
            (m: any) => m.modelId === "Model_PKG_v2_Combined" || 
                       m.description === "Model_PKG_v2_Combined"
          );
          setSelectedModelId(defaultModel?.modelId || data.customModels[0].modelId);
        }
        
        toast({
          title: "Models loaded automatically",
          description: `Found ${data.customCount || 0} custom models. Default model selected.`
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

  const handleReset = async () => {
    // Clear all file selections
    setPdfFiles([]);
    setExcelFile(null);
    
    // Clear all results and data
    setAnalysisResults(null);
    setComparisonResults(null);
    setBatchResults([]);
    setExcelData([]);
    setSelectedInputs([]);
    setParsedPdfFilenames([]);
    
    // Reset model selection
    setSelectedModelId("");
    setCustomModels([]);
    setModels([]);
    setCustomCount(0);
    
    // Reset Azure configuration
    setAzureEndpoint("");
    setApiVersion("");
    
    // Reload all models
    modelsLoadedRef.current = false;
    await loadAllModels();
    modelsLoadedRef.current = true;
    
    toast({
      title: "Reset complete",
      description: "All data cleared and models reloaded successfully."
    });
  };

  // Removed local processBatchPdfComparison - now using shared logic from IndexBatchLogic.ts

  const processSinglePdf = async () => {
    if (pdfFiles.length === 0 || !selectedModelId || selectedInputs.length === 0) {
      toast({
        title: "Missing Requirements",
        description: "Please upload a PDF, select a model, and choose inputs to check",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      await analyzePdf();
      
      setIsAnalyzing(false);
      setIsComparing(true);
      await comparePdfWithSelectedInputs();
      setIsComparing(false);
    } catch (error) {
      console.error("Combined check error:", error);
      setIsAnalyzing(false);
      setIsComparing(false);
      toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : "An error occurred during the check",
        variant: "destructive"
      });
    }
  };

  const downloadBatchPDFReports = () => {
    if (!batchResults.length) return;
    
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    
    batchResults.forEach((result, index) => {
      if (index > 0) doc.addPage();
      
      // Title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(`Report for: ${result.filename}`, 14, 15);
      
      // Prepare ALL comparison results (no filtering)
      const tableData = result.comparisonResults.map((compResult: any) => {
        let statusText = '';
        if (compResult.status === 'correct') statusText = 'MATCHED';
        else if (compResult.status === 'incorrect') statusText = 'MISMATCHED';
        else statusText = 'NOT FOUND';
        
        return [
          compResult.field,
          compResult.excelValue,
          compResult.pdfValue + (compResult.matchDetails ? `\n${compResult.matchDetails}` : ''),
          statusText
        ];
      });
      
      // Generate table with color-coded status column
      autoTable(doc, {
        head: [['Field Name', 'SAP Data (from Excel file)', 'Info from Pack', 'Comparison']],
        body: tableData,
        startY: 25,
        theme: 'grid',
        styles: { 
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [71, 85, 105], // slate-600
          textColor: 255,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 70 },
          2: { cellWidth: 70 },
          3: { 
            cellWidth: 45,
            halign: 'center',
            fontStyle: 'bold'
          },
        },
        didParseCell: (data) => {
          // Apply color coding to Comparison column
          if (data.column.index === 3 && data.section === 'body') {
            const status = result.comparisonResults[data.row.index].status;
            if (status === 'correct') {
              data.cell.styles.textColor = [22, 163, 74]; // Green
            } else if (status === 'incorrect') {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            } else if (status === 'not-found') {
              data.cell.styles.textColor = [245, 158, 11]; // Amber
            }
          }
        }
      });
    });
    
    doc.save(`batch-report-${new Date().toISOString().slice(0,10)}.pdf`);
    toast({ title: "PDF reports downloaded", description: `Generated ${batchResults.length} pages with color-coded status` });
  };

  const downloadBatchExcelReport = () => {
    if (!batchResults.length || !session?.user?.email) return;

    try {
      // Create rows following the same structure as single PDF report
      const reportRows = batchResults.map(result => {
        // 1. Timestamp
        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        
        const reportRow: any = {
          'Timestamp': timestamp,
          'User': session.user.email,
          'File Name': result.filename
        };

        // 2. Add RESULT columns (from comparison results)
        result.comparisonResults.forEach((compResult: any) => {
          const status = compResult.status === 'correct' ? 'MATCHED' : 
                         compResult.status === 'incorrect' ? 'MISMATCHED' : 
                         'Not Found';
          
          // Extract field name - handle parentheses
          let fieldName = compResult.field;
          const parenMatch = fieldName.match(/\(([^)]+)\)/);
          if (parenMatch) {
            fieldName = parenMatch[1];
          }
          
          reportRow[`RESULT_${fieldName}`] = status;
        });

        // 3. Add SAP columns (from selected inputs)
        if (result.selectedInputs) {
          result.selectedInputs.forEach((input: any) => {
            reportRow[`${input.column}_SAP`] = input.value;
          });
        }

        // 4. Add PDF Analysis columns (from analysis results)
        if (result.analysisResults?.fields) {
          Object.entries(result.analysisResults.fields).forEach(([key, value]) => {
            reportRow[key] = String(value);
          });
        }

        return reportRow;
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(reportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Report");

      // Apply cell styling (same as single PDF report)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const firstRow = reportRows[0];
      const columnKeys = Object.keys(firstRow);
      
      columnKeys.forEach((key, col) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) return;
        
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        
        // Apply color based on column type
        if (key.startsWith('RESULT_')) {
          // RED for RESULT columns
          worksheet[cellAddress].s = {
            font: { color: { rgb: "FF0000" }, bold: true }
          };
        } else if (key.endsWith('_SAP')) {
          // BLUE for SAP columns
          worksheet[cellAddress].s = {
            font: { color: { rgb: "0000FF" }, bold: true }
          };
        } else if (!['Timestamp', 'User', 'File Name'].includes(key)) {
          // BLACK for PDF columns
          worksheet[cellAddress].s = {
            font: { color: { rgb: "000000" }, bold: true }
          };
        }
      });
      
      XLSX.writeFile(workbook, `Batch_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast({ 
        title: "Excel report downloaded", 
        description: `Generated report with ${batchResults.length} PDFs` 
      });
    } catch (error) {
      console.error('Error generating batch Excel report:', error);
      toast({ 
        title: "Report generation failed", 
        description: error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive" 
      });
    }
  };

  const handleCombinedCheck = async () => {
    if (pdfFiles.length > 1) {
      const results = await runBatchComparison(
        pdfFiles,
        parsedPdfFilenames,
        selectedModelId,
        excelData,
        setCurrentProcessingIndex,
        setIsBatchProcessing,
        toast
      );
      setBatchResults(results);
    } else {
      await processSinglePdf();
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
            <div className="flex justify-end items-center gap-4 mb-4">
              {/* Backend Status Indicator */}
              {SHOW_BACKEND_STATUS && backendVersionsChecked && (
                <Alert className={`flex items-center gap-2 py-2 px-3 w-auto ${backendVersionsOutdated ? 'border-amber-500 bg-amber-50' : 'border-green-500 bg-green-50'}`}>
                  {backendVersionsOutdated ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-900 m-0">
                        Backend may be outdated.{' '}
                        <a href="/diagnostics" className="underline font-medium">Check Diagnostics</a>
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-xs text-green-900 m-0">
                        Backend up to date
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
                <span className="text-sm font-medium">{session.user.email}</span>
              </div>
              <AdminButton />
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <FileCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI QC Tool for LEGO Packaging
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              This is a QC tool to perform number check and text check, powered by AI.
            </p>
          </div>

          {/* Resource Details */}
          {SHOW_AZURE_RESOURCE_DETAILS && azureEndpoint && apiVersion && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ResourceDetails
                endpoint={azureEndpoint}
                apiVersion={apiVersion}
                customModels={customCount}
                onReset={handleReset}
              >
                {/* Model Selection Dropdown */}
                {customModels.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Select Analysis Model
                    </label>
                    <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {customModels.map((model) => (
                          <SelectItem key={model.modelId} value={model.modelId}>
                            <div className="flex flex-col">
                              <span className="font-medium">{model.description || model.modelId}</span>
                              <span className="text-xs text-muted-foreground">{model.modelId}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </ResourceDetails>
            </div>
          )}

          {/* Model Selection - Shown when Azure details are hidden */}
          {!SHOW_AZURE_RESOURCE_DETAILS && customModels.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <label className="text-lg font-semibold whitespace-nowrap">Select Model</label>
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger className="w-auto min-w-[300px] flex-1">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {customModels.map((model) => (
                        <SelectItem key={model.modelId} value={model.modelId}>
                          <span className="text-sm">{model.modelId}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            </div>
          )}


          {/* File Upload Section - PDF and Excel Cards in Same Row */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PDF Upload Card */}
                <FileUpload
                  onFileSelect={handleFileSelect}
                  pdfFiles={pdfFiles}
                  onRemovePdf={handleRemovePdf}
                  onValidationError={(message) => toast({
                    title: "Validation Error",
                    description: message,
                    variant: "destructive"
                  })}
                />
                
                {/* Excel Upload Card */}
                <FileUpload
                  onExcelSelect={handleExcelFileSelect}
                  excelFile={excelFile}
                />
              </div>
            </Card>
          </div>

          {/* Progress Indicator for Batch Processing */}
          {isBatchProcessing && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Processing PDFs...</h3>
                    <span className="text-sm text-muted-foreground">
                      {currentProcessingIndex + 1} / {pdfFiles.length}
                    </span>
                  </div>
                  <Progress value={((currentProcessingIndex + 1) / pdfFiles.length) * 100} />
                  <p className="text-sm text-muted-foreground">
                    Currently processing: {pdfFiles[currentProcessingIndex]?.name}
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* Action Buttons Section - Full Width Second Row */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Combined Check Button */}
                <Button
                  onClick={handleCombinedCheck}
                  disabled={pdfFiles.length === 0 || !selectedModelId || selectedInputs.length === 0 || isAnalyzing || isComparing || isBatchProcessing}
                  size="lg"
                  className="flex-1"
                >
                  {isBatchProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing {currentProcessingIndex + 1}/{pdfFiles.length}
                    </>
                  ) : isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing Document...
                    </>
                  ) : isComparing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Checking Results...
                    </>
                  ) : (
                    <>
                      <GitCompare className="w-5 h-5 mr-2" />
                      {pdfFiles.length > 1 ? `Compare ${pdfFiles.length} PDFs` : 'Check'}
                    </>
                  )}
                </Button>
                
                {/* Reset All Button */}
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Reset All
                </Button>
              </div>
            </Card>
          </div>

          {/* Batch Results */}
          {batchResults.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BatchComparisonResults
                batchResults={batchResults}
                onDownloadBatchPDF={downloadBatchPDFReports}
                onDownloadBatchExcel={downloadBatchExcelReport}
              />
            </div>
          )}

          {/* Comparison Results (for single PDF) */}
          {comparisonResults && comparisonResults.length > 0 && batchResults.length === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ComparisonResults 
                results={comparisonResults}
                onDownloadReport={downloadComparisonReport}
              />
            </div>
          )}

          {/* Cascading Dropdowns Section - At the end */}
          {excelFile && excelData.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CascadingDropdowns 
                excelFile={excelFile}
                onSelectedInputsChange={handleSelectedInputsChange}
                onPrimaryKeyChange={handlePrimaryKeyChange}
                autoPopulateTrigger={parsedPdfFilenames[0] || null}
              />
            </div>
          )}

          {/* Analysis Results */}
          {/*
          analysisResults && (
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
                  )*/
                  }

        </div>
      </div>
    </div>
  );
};

export default Index;
