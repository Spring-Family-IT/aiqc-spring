import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComparisonResults } from "@/components/ComparisonResults";
import { CheckCircle2, XCircle, FileText, Download, GitCompare } from "lucide-react";
import { ParsedPdfFilename } from "@/lib/pdfFilenameParser";

interface BatchResultData {
  filename: string;
  comparisonResults: any[];
  analysisResults: any;
  selectedInputs: any[];
  parsedFilename: ParsedPdfFilename | null;
  summary?: any;
  error?: string;
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

export const BatchComparisonResults = ({ 
  batchResults, 
  onDownloadBatchPDF,
  onDownloadBatchExcel 
}: BatchComparisonResultsProps) => {
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  
  const successfulCount = batchResults.filter(r => !r.error).length;
  const failedCount = batchResults.filter(r => r.error).length;
  const avgMatchRate = calculateAverageMatchRate(batchResults);

  return (
    <div className="space-y-6">
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
      
      {/* Horizontal Scrollable Tabs for Each PDF */}
      <Card className="p-4">
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {batchResults.map((result, index) => (
              <Button
                key={index}
                variant={selectedResultIndex === index ? "default" : "outline"}
                onClick={() => setSelectedResultIndex(index)}
                className="shrink-0 whitespace-nowrap"
              >
                <FileText className="w-4 h-4 mr-2" />
                {result.filename}
                {result.error && <XCircle className="w-4 h-4 ml-2 text-destructive" />}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </Card>
      
      {/* Download All Reports */}
      <div className="flex gap-2 justify-end">
        <Button onClick={onDownloadBatchPDF} variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Save All PDFs
        </Button>
        <Button onClick={onDownloadBatchExcel} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Save Excel Report
        </Button>
      </div>
      
      {/* Show Individual Result */}
      {batchResults[selectedResultIndex] && (
        <div>
          {batchResults[selectedResultIndex].error ? (
            <Card className="p-6 bg-destructive/5">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-destructive" />
                <div>
                  <h3 className="text-lg font-semibold">Processing Failed</h3>
                  <p className="text-sm text-muted-foreground">
                    {batchResults[selectedResultIndex].error}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <ComparisonResults
              results={batchResults[selectedResultIndex].comparisonResults}
              onDownloadReport={onDownloadBatchExcel}
            />
          )}
        </div>
      )}
    </div>
  );
};
