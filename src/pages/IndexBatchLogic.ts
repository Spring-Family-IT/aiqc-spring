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
      // 1. Establish primary key from filename
      const parsedFilename = parsedPdfFilenames[i];
      let currentSelectedInputs: any[] = [];
      let primaryKeyStatus = {
        established: false,
        reason: '',
        matchingRow: null as any
      };
      
      if (!parsedFilename) {
        primaryKeyStatus.reason = 'Failed to parse PDF filename. Expected format: SKU_Version_Type_...';
        toast({
          title: `⚠️ Primary Key Failed: ${pdfFile.name}`,
          description: primaryKeyStatus.reason,
          variant: "destructive",
        });
      } else if (excelData.length === 0) {
        primaryKeyStatus.reason = 'No Excel data loaded';
        toast({
          title: `⚠️ No Excel Data`,
          description: 'Please upload and select Excel data first',
          variant: "destructive",
        });
      } else {
        // 2. Search for matching row in Excel
        const { sku, version, descriptionType } = parsedFilename;
        const matchingRow = excelData.find(row => {
          const rowSku = String(row['Communication no.'] || '').trim();
          const rowVersion = String(row['Name of Dependency'] || '').trim();
          const rowDescription = String(row['Description'] || '').trim().toUpperCase();
          
          // Normalize abbreviated Excel Description values to match parsed filename types
          let normalizedDescription = rowDescription;
          if (rowDescription === 'MA') {
            normalizedDescription = 'MA-BOX';
          } else if (rowDescription === 'SA') {
            normalizedDescription = 'SEMI';
          }
          
          return rowSku === sku && 
                 rowVersion === version && 
                 normalizedDescription === descriptionType;
        });
        
        if (!matchingRow) {
          primaryKeyStatus.reason = `No Excel row found for SKU: ${sku}, Version: ${version}, Type: ${descriptionType}`;
          toast({
            title: `⚠️ No Match Found: ${pdfFile.name}`,
            description: primaryKeyStatus.reason,
            variant: "destructive",
          });
        } else {
          // 3. Primary key established! Build ALL fields from mapping
          primaryKeyStatus.established = true;
          primaryKeyStatus.matchingRow = matchingRow;
          
          const fieldMappingConfig = getFieldMapping(selectedModelId);
          const fieldMapping = fieldMappingConfig.mappings;
          
          // Include ALL mapped fields, even if value is empty
          currentSelectedInputs = Object.entries(fieldMapping).map(([excelCol]) => ({
            column: excelCol,
            value: String(matchingRow[excelCol] || '') // Use empty string if no value
          }));
          
          toast({
            title: `✅ Primary Key Established: ${pdfFile.name}`,
            description: `Found match: ${sku} / ${version} / ${descriptionType} (${currentSelectedInputs.length} fields)`,
          });
        }
      }
      
      // Only proceed with comparison if primary key was established
      if (!primaryKeyStatus.established || currentSelectedInputs.length === 0) {
        // Store failed result
        results.push({
          filename: pdfFile.name,
          comparisonResults: [],
          analysisResults: null,
          selectedInputs: [],
          parsedFilename: parsedFilename,
          primaryKeyStatus: primaryKeyStatus,
          error: primaryKeyStatus.reason,
          errorType: 'primary_key_failed'
        });
        continue; // Skip to next PDF
      }
      
      // 4. Compare PDF with inputs
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('selectedInputs', JSON.stringify(currentSelectedInputs));
      formData.append('modelId', selectedModelId);

      const { data, error } = await supabase.functions.invoke('compare-documents', {
        body: formData,
      });

      if (error) throw error;

      // 5. Store result
      results.push({
        filename: pdfFile.name,
        comparisonResults: data.results || [],
        analysisResults: data.analysisResults || {},
        selectedInputs: currentSelectedInputs,
        parsedFilename: parsedFilename,
        summary: data.summary
      });
      
      // Show individual PDF report
      toast({
        title: `📄 Report Generated: ${pdfFile.name}`,
        description: `✅ ${data.summary?.correct || 0} correct, ❌ ${data.summary?.incorrect || 0} incorrect, ⚠️ ${data.summary?.notFound || 0} not found`,
        duration: 5000,
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
  
  // Compile statistics
  const totalPdfs = results.length;
  const successfulPdfs = results.filter(r => !r.error).length;
  const failedPdfs = results.filter(r => r.error).length;
  const primaryKeyFailed = results.filter(r => r.errorType === 'primary_key_failed').length;
  const totalCorrect = results.reduce((sum, r) => sum + (r.summary?.correct || 0), 0);
  const totalIncorrect = results.reduce((sum, r) => sum + (r.summary?.incorrect || 0), 0);
  const totalNotFound = results.reduce((sum, r) => sum + (r.summary?.notFound || 0), 0);
  
  toast({
    title: "📊 Batch Processing Complete - Compilation Report",
    description: `Total: ${totalPdfs} PDFs | ✅ ${successfulPdfs} successful | ❌ ${failedPdfs} failed (${primaryKeyFailed} primary key)\nFields: ${totalCorrect} correct, ${totalIncorrect} incorrect, ${totalNotFound} not found`,
    duration: 10000,
  });

  return results;
};
