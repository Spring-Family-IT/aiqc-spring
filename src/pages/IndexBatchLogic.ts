// Batch processing logic separated for clarity
import { supabase } from "@/integrations/supabase/client";
import { getFieldMapping } from "@/config/fieldMappings";
import { ParsedPdfFilename } from "@/lib/pdfFilenameParser";

export const processBatchPdfComparison = async (
  pdfFiles: File[],
  parsedPdfFilenames: (ParsedPdfFilename | null)[],
  selectedModelId: string,
  excelData: any[],
  setCurrentProcessingIndex: (index: number) => void,
  setIsBatchProcessing: (value: boolean) => void,
  toast: any
) => {
  if (pdfFiles.length === 0 || !selectedModelId || excelData.length === 0) {
    toast({
      title: "Missing Requirements",
      description: "Please upload PDFs, Excel data, and select a model",
      variant: "destructive",
    });
    return [];
  }

  setIsBatchProcessing(true);
  const results: any[] = [];

  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfFile = pdfFiles[i];
    setCurrentProcessingIndex(i);
    
    try {
      // 1. Auto-populate from filename
      const parsedFilename = parsedPdfFilenames[i];
      let currentSelectedInputs: any[] = [];
      
      if (parsedFilename && excelData.length > 0) {
        const { sku, version, descriptionType } = parsedFilename;
        const matchingRow = excelData.find(row => {
          const rowSku = String(row['Communication no.'] || '').trim();
          const rowVersion = String(row['Name of Dependency'] || '').trim();
          const rowDescription = String(row['Description'] || '').trim().toUpperCase();
          
          return rowSku === sku && 
                 rowVersion === version && 
                 rowDescription === descriptionType;
        });
        
        if (matchingRow) {
          // Build selected inputs from matching row
          const fieldMappingConfig = getFieldMapping(selectedModelId);
          const fieldMapping = fieldMappingConfig.mappings;
          currentSelectedInputs = Object.entries(fieldMapping)
            .filter(([excelCol]) => matchingRow[excelCol])
            .map(([excelCol]) => ({
              column: excelCol,
              value: String(matchingRow[excelCol])
            }));
        }
      }
      
      // 2. Compare PDF with inputs
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('selectedInputs', JSON.stringify(currentSelectedInputs));
      formData.append('modelId', selectedModelId);

      const { data, error } = await supabase.functions.invoke('compare-documents', {
        body: formData,
      });

      if (error) throw error;

      // 3. Store result
      results.push({
        filename: pdfFile.name,
        comparisonResults: data.results || [],
        analysisResults: data.analysisResults || {},
        selectedInputs: currentSelectedInputs,
        parsedFilename: parsedFilename,
        summary: data.summary
      });
      
      toast({
        title: `Processed ${i + 1}/${pdfFiles.length}`,
        description: `Completed: ${pdfFile.name}`,
      });
      
    } catch (error) {
      console.error(`Error processing ${pdfFile.name}:`, error);
      results.push({
        filename: pdfFile.name,
        comparisonResults: [],
        analysisResults: null,
        selectedInputs: [],
        parsedFilename: parsedPdfFilenames[i],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  setIsBatchProcessing(false);
  setCurrentProcessingIndex(0);
  
  toast({
    title: "Batch processing complete",
    description: `Processed ${results.length} PDF files`,
  });

  return results;
};
