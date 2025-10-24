import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLUMN_DISPLAY_NAMES: Record<string, string> = {
  'Communication no.': 'SKU',
  'Product Age Classification': 'Age',
  'Name of Dependency': 'Version',
  'Piece count of FG': 'Piece Count',
  'Component': 'Material Number',
  'Finished Goods Material Number': 'Item Number',
  'Material': 'Product Name',
  'EAN/UPC': 'EAN/UPC',
  'Super Design': 'Super Design',
  'Description': 'Description',
  'Type': 'Type',
};

const getDisplayName = (fieldName: string): string => {
  // Handle fields with PDF field names in parentheses like "EAN/UPC (Barcode)"
  const match = fieldName.match(/^(.+?)\s*\((.+)\)$/);
  if (match) {
    const [, excelColumn, pdfField] = match;
    const displayName = COLUMN_DISPLAY_NAMES[excelColumn] || excelColumn;
    return `${displayName} (${pdfField})`;
  }
  return COLUMN_DISPLAY_NAMES[fieldName] || fieldName;
};

interface ComparisonData {
  field: string;
  pdfValue: string;
  excelValue: string;
  status: 'correct' | 'incorrect' | 'not-found';
  matchDetails?: string;
}

interface ComparisonResultsProps {
  results: ComparisonData[];
  onDownloadReport?: () => void;
}

export const ComparisonResults = ({ results, onDownloadReport }: ComparisonResultsProps) => {
  const correctCount = results.filter(r => r.status === 'correct').length;
  const incorrectCount = results.filter(r => r.status === 'incorrect').length;
  const notFoundCount = results.filter(r => r.status === 'not-found').length;
  const matchPercentage = results.length > 0 
    ? Math.round((correctCount / results.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Fields</p>
              <p className="text-2xl font-bold">{results.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Matched</p>
              <p className="text-2xl font-bold text-success">{correctCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mismatched</p>
              <p className="text-2xl font-bold text-destructive">{incorrectCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Not Found</p>
              <p className="text-2xl font-bold text-warning">{notFoundCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Match Rate</h3>
          <Badge variant={matchPercentage >= 80 ? "default" : "destructive"}>
            {matchPercentage}%
          </Badge>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-success to-accent transition-all duration-500"
            style={{ width: `${matchPercentage}%` }}
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Field Comparison Report</h3>
          <Button onClick={onDownloadReport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
        
        {/* Fixed Header Table */}
        <div className="border rounded-t-md overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[20%] font-semibold border-r">Field Name</TableHead>
                <TableHead className="w-[30%] font-semibold border-r">SAP Data (from Excel file)</TableHead>
                <TableHead className="w-[30%] font-semibold border-r">Info from Pack</TableHead>
                <TableHead className="w-[20%] font-semibold">Comparison</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Scrollable Data Table */}
        <div className="border border-t-0 rounded-b-md overflow-hidden">
          <ScrollArea className="h-[500px]">
            <Table className="table-fixed">
              <TableBody>
                {results.map((result, index) => {
                  const statusBadge = 
                    result.status === 'correct' ? (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        MATCHED
                      </Badge>
                    ) : result.status === 'incorrect' ? (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        MISMATCHED
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-warning text-warning-foreground">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        NOT FOUND
                      </Badge>
                    );

                  const rowClass = 
                    result.status === 'correct' ? 'bg-success/5' :
                    result.status === 'incorrect' ? 'bg-destructive/5' :
                    'bg-warning/5';
                    
                  return (
                    <TableRow key={index} className={rowClass}>
                      <TableCell className="w-[20%] font-medium border-r">{getDisplayName(result.field)}</TableCell>
                      <TableCell className="w-[30%] font-mono text-sm border-r">{result.excelValue}</TableCell>
                      <TableCell className="w-[30%] font-mono text-sm border-r">
                        {result.pdfValue}
                        {result.matchDetails && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{result.matchDetails}</p>
                        )}
                      </TableCell>
                      <TableCell className="w-[20%]">{statusBadge}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
};
