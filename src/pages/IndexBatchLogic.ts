// Batch processing logic separated for clarity
import { supabase } from "@/integrations/supabase/client";
import { getFieldMapping } from "@/config/fieldMappings";
import { ParsedPdfFilename } from "@/lib/pdfFilenameParser";
import { normalizeFieldValue } from "@/lib/valueNormalizer";

// Utility function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Delay between processing PDFs to avoid rate limits (15 seconds)
const PROCESSING_DELAY_MS = 15000;

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
        console.log(`🔍 Looking for: SKU="${sku}", Version="${version}", Type="${descriptionType}"`);
        
        // Log Excel column structure once
        if (i === 0 && excelData.length > 0) {
          console.log('🧭 Excel columns detected:', Object.keys(excelData[0]));
        }
        
        const matchingRow = excelData.find((row, rowIndex) => {
          const rowSku = String(row['Communication no.'] || '').trim();
          const rowVersionPrimary = String(row['Name of Dependency'] || '').trim();
          const rowVersionFallback = String(row['Product Version no.'] || '').trim();
          const rowDescription = String(row['Description'] || '').trim().toUpperCase();
          
          // Use primary version column, fallback to Product Version no.
          const rowVersion = rowVersionPrimary || rowVersionFallback;
          
          // Log first 3 rows for debugging (only for first PDF)
          if (i === 0 && rowIndex < 3) {
            console.log(`📋 Excel row ${rowIndex}: SKU="${rowSku}", Version="${rowVersion}", Desc="${rowDescription}"`);
          }
          
          // Case-insensitive version comparison
          const versionMatch = rowVersion.toUpperCase() === version.toUpperCase();
          
          // Description matching: check if Excel description contains the type keyword
          const descriptionMatch = rowDescription.includes(descriptionType);
          
          return (
            rowSku === sku &&
            versionMatch &&
            descriptionMatch
          );
        });
        
        if (!matchingRow) {
          // Find rows that match just SKU
          const skuMatches = excelData.filter(row => 
            String(row['Communication no.'] || '').trim() === sku
          );
          console.log(`❌ No match found. Found ${skuMatches.length} rows with SKU="${sku}"`);
          
          if (skuMatches.length > 0) {
            console.log('📊 Available versions for this SKU:', 
              skuMatches.map(r => {
                const primary = String(r['Name of Dependency'] || '').trim();
                const fallback = String(r['Product Version no.'] || '').trim();
                return primary || fallback;
              }).slice(0, 10));
            console.log('📊 Available descriptions for this SKU:', 
              skuMatches.map(r => String(r['Description'] || '').trim()).slice(0, 10));
            
            // Find candidates matching SKU + Version (case-insensitive)
            const versionMatches = skuMatches.filter(r => {
              const primary = String(r['Name of Dependency'] || '').trim();
              const fallback = String(r['Product Version no.'] || '').trim();
              const rowVersion = primary || fallback;
              return rowVersion.toUpperCase() === version.toUpperCase();
            });
            
            if (versionMatches.length > 0) {
              console.log(`🎯 Found ${versionMatches.length} rows matching SKU+Version, but Description mismatch:`);
              console.log('   Available descriptions:', 
                versionMatches.map(r => String(r['Description'] || '').trim()));
            }
          }
          
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
            value: normalizeFieldValue(excelCol, String(matchingRow[excelCol] || '')) // Apply normalization
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

      // Add delay between processing to avoid rate limits
      // Skip delay for the last PDF
      if (i < pdfFiles.length - 1) {
        console.log(`⏳ Waiting ${PROCESSING_DELAY_MS / 1000} seconds before next PDF...`);
        await delay(PROCESSING_DELAY_MS);
      }
      
    } catch (error) {
      console.error(`Error processing ${pdfFile.name}:`, error);
      
      // Determine error type for better handling
      let errorType = 'unknown';
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Detect rate limit error (429)
        if (errorMessage.includes('429') || 
            errorMessage.includes('rate limit') || 
            errorMessage.includes('call rate limit')) {
          errorType = 'rate_limit';
          errorMessage = 'API rate limit exceeded. The system is processing too many requests. Please wait 30 seconds before trying again.';
          
          toast({
            title: `⏳ Rate Limit Reached: ${pdfFile.name}`,
            description: errorMessage,
            variant: "destructive",
            duration: 8000,
          });
        }
        // Detect network errors
        else if (errorMessage.includes('fetch') || 
                 errorMessage.includes('network') || 
                 errorMessage.includes('Failed to fetch')) {
          errorType = 'network';
          errorMessage = 'Network error occurred. Please check your connection.';
        }
      }
      
      results.push({
        filename: pdfFile.name,
        comparisonResults: [],
        analysisResults: null,
        selectedInputs: [],
        parsedFilename: parsedPdfFilenames[i],
        error: errorMessage,
        errorType: errorType
      });
      
      // If rate limit error, add extra delay before continuing
      if (errorType === 'rate_limit') {
        console.log('⏳ Rate limit detected, adding 30 second delay...');
        await delay(30000); // Wait 30 seconds before processing next PDF
      }
    }
  }

  setIsBatchProcessing(false);
  setCurrentProcessingIndex(0);
  
  // Compile statistics
  const totalPdfs = results.length;
  const successfulPdfs = results.filter(r => !r.error).length;
  const failedPdfs = results.filter(r => r.error).length;
  const primaryKeyFailed = results.filter(r => r.errorType === 'primary_key_failed').length;
  const rateLimitFailed = results.filter(r => r.errorType === 'rate_limit').length;
  const totalCorrect = results.reduce((sum, r) => sum + (r.summary?.correct || 0), 0);
  const totalIncorrect = results.reduce((sum, r) => sum + (r.summary?.incorrect || 0), 0);
  const totalNotFound = results.reduce((sum, r) => sum + (r.summary?.notFound || 0), 0);
  
  toast({
    title: "📊 Batch Processing Complete - Compilation Report",
    description: `Total: ${totalPdfs} PDFs | ✅ ${successfulPdfs} successful | ❌ ${failedPdfs} failed (${primaryKeyFailed} primary key, ${rateLimitFailed} rate limit)\nFields: ${totalCorrect} correct, ${totalIncorrect} incorrect, ${totalNotFound} not found`,
    duration: 10000,
  });

  return results;
};
