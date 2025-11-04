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
