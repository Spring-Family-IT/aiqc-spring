import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComparisonResults } from "@/components/ComparisonResults";
import { CheckCircle2, XCircle, FileText, Download, GitCompare, WifiOff, Clock, AlertCircle, Key } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ParsedPdfFilename } from "@/lib/pdfFilenameParser";

interface BatchResultData {
  filename: string;
  comparisonResults: any[];
  analysisResults: any;
  selectedInputs: any[];
  parsedFilename: ParsedPdfFilename | null;
  summary?: any;
  error?: string;
  errorType?: string;
  primaryKeyStatus?: any;
}

interface BatchComparisonResultsProps {
  batchResults: BatchResultData[];
  onDownloadBatchPDF: () => void;
  onDownloadBatchExcel: () => void;
}

const calculateAverageMatchRate = (results: BatchResultData[]): number => {
  if (results.length === 0) return 0;
  
  const validResults = results.filter(r => !r.error && r.comparisonResults.length > 0);
  if (validResults.length === 0) return 0;
  
  const totalMatchRate = validResults.reduce((sum, result) => {
    const correctCount = result.comparisonResults.filter(r => r.status === 'correct').length;
    const matchRate = result.comparisonResults.length > 0 
      ? (correctCount / result.comparisonResults.length) * 100 
      : 0;
    return sum + matchRate;
  }, 0);
  
  return Math.round(totalMatchRate / validResults.length);
};

const calculateCompilationStats = (results: BatchResultData[]) => {
  return {
    totalPdfs: results.length,
    successful: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    primaryKeyFailed: results.filter(r => r.errorType === 'primary_key_failed').length,
    networkFailed: results.filter(r => r.errorType === 'network').length,
    totalCorrect: results.reduce((sum, r) => sum + (r.summary?.correct || 0), 0),
    totalIncorrect: results.reduce((sum, r) => sum + (r.summary?.incorrect || 0), 0),
    totalNotFound: results.reduce((sum, r) => sum + (r.summary?.notFound || 0), 0),
  };
};

export const BatchComparisonResults = ({ 
  batchResults, 
  onDownloadBatchPDF,
  onDownloadBatchExcel 
}: BatchComparisonResultsProps) => {
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  
  const successfulCount = batchResults.filter(r => !r.error).length;
  const failedCount = batchResults.filter(r => r.error).length;
  const avgMatchRate = calculateAverageMatchRate(batchResults);
  const compilationStats = calculateCompilationStats(batchResults);

  return (
    <div className="space-y-6">
      {/* Compilation Statistics */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          Compilation Report
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Fields</p>
            <p className="text-xl font-bold">{compilationStats.totalCorrect + compilationStats.totalIncorrect + compilationStats.totalNotFound}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Correct</p>
            <p className="text-xl font-bold text-success">✅ {compilationStats.totalCorrect}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Incorrect</p>
            <p className="text-xl font-bold text-destructive">❌ {compilationStats.totalIncorrect}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Not Found</p>
            <p className="text-xl font-bold text-amber-500">⚠️ {compilationStats.totalNotFound}</p>
          </div>
          {compilationStats.primaryKeyFailed > 0 && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Primary Key Failed</p>
              <p className="text-xl font-bold text-amber-500">🔑 {compilationStats.primaryKeyFailed} PDFs</p>
            </div>
          )}
        </div>
      </Card>
      
      {/* Summary Cards for All Results */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total PDFs</p>
              <p className="text-2xl font-bold">{batchResults.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-success">{successfulCount}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-destructive">{failedCount}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <GitCompare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Match Rate</p>
              <p className="text-2xl font-bold">{avgMatchRate}%</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Horizontal Scrollable PDF Selector - Positioned just above report */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Select PDF to view details:
          </h3>
          <span className="text-xs text-muted-foreground">
            {batchResults.length} PDFs • Scroll horizontally →
          </span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border bg-muted/20 p-2">
          <div className="flex gap-2">
            {batchResults.map((result, index) => (
              <Button
                key={index}
                size="sm"
                variant={selectedResultIndex === index ? "default" : "ghost"}
                onClick={() => setSelectedResultIndex(index)}
                className="shrink-0 min-w-[140px] justify-start"
              >
                <FileText className="w-3 h-3 mr-2 shrink-0" />
                <span className="truncate">{result.filename}</span>
                {result.error && (
                  <span className="ml-auto shrink-0">
                    {result.errorType === 'primary_key_failed' ? (
                      <Key className="w-3 h-3 text-amber-500" />
                    ) : result.errorType === 'network' ? (
                      <WifiOff className="w-3 h-3 text-destructive" />
                    ) : result.errorType === 'rate_limit' ? (
                      <Clock className="w-3 h-3 text-amber-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </Card>
      
      {/* Show Individual Result */}
      {batchResults[selectedResultIndex] && (
        <div>
          {batchResults[selectedResultIndex].error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Processing Failed</AlertTitle>
              <AlertDescription>
                {batchResults[selectedResultIndex].error}
                {batchResults[selectedResultIndex].errorType === 'primary_key_failed' && (
                  <p className="mt-2 text-sm">
                    Primary key could not be established. Please check the PDF filename format (should be: SKU_Version_Type_...) and ensure matching Excel data exists.
                  </p>
                )}
                {batchResults[selectedResultIndex].errorType === 'network' && (
                  <p className="mt-2 text-sm">
                    This was a network connectivity issue. You can try processing this file again.
                  </p>
                )}
                {batchResults[selectedResultIndex].errorType === 'rate_limit' && (
                  <p className="mt-2 text-sm">
                    The API rate limit was exceeded. Please wait 30 seconds before trying again.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <ComparisonResults
              results={batchResults[selectedResultIndex].comparisonResults}
              onDownloadReport={onDownloadBatchExcel}
              onDownloadBatchPDF={onDownloadBatchPDF}
              isBatchMode={true}
            />
          )}
        </div>
      )}
    </div>
  );
};
