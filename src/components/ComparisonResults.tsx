import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComparisonData {
  field: string;
  pdfValue: string;
  excelValue: string;
  status: 'correct' | 'incorrect' | 'not-found';
  matchDetails?: string;
}

interface ComparisonResultsProps {
  results: ComparisonData[];
}

export const ComparisonResults = ({ results }: ComparisonResultsProps) => {
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
              <p className="text-sm text-muted-foreground">Correct</p>
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
              <p className="text-sm text-muted-foreground">Incorrect</p>
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
        <h3 className="text-lg font-semibold mb-4">Field Comparison Report</h3>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Field Name</TableHead>
                <TableHead>Excel Value</TableHead>
                <TableHead>PDF Value</TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, index) => {
                const statusBadge = 
                  result.status === 'correct' ? (
                    <Badge variant="default" className="bg-success text-success-foreground">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      CORRECT
                    </Badge>
                  ) : result.status === 'incorrect' ? (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" />
                      INCORRECT
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
                    <TableCell className="font-medium">{result.field}</TableCell>
                    <TableCell className="font-mono text-sm">{result.excelValue}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {result.pdfValue}
                      {result.matchDetails && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{result.matchDetails}</p>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
};
