import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComparisonData {
  field: string;
  pdfValue: string | string[];
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
        <h3 className="text-lg font-semibold mb-4">Field Comparison</h3>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {results.map((result, index) => {
              const bgColor = 
                result.status === 'correct' ? 'bg-success/5 border-success/20' :
                result.status === 'incorrect' ? 'bg-destructive/5 border-destructive/20' :
                'bg-warning/5 border-warning/20';
                
              const icon = 
                result.status === 'correct' ? <CheckCircle2 className="w-4 h-4 text-success" /> :
                result.status === 'incorrect' ? <XCircle className="w-4 h-4 text-destructive" /> :
                <AlertCircle className="w-4 h-4 text-warning" />;
                
              return (
                <Card 
                  key={index} 
                  className={`p-4 ${bgColor}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.field}</span>
                      {icon}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">PDF Value:</p>
                      <p className="font-mono bg-background/50 p-2 rounded">
                        {Array.isArray(result.pdfValue) 
                          ? result.pdfValue.join(', ') 
                          : result.pdfValue}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Excel Value:</p>
                      <p className="font-mono bg-background/50 p-2 rounded">{result.excelValue}</p>
                    </div>
                  </div>
                  {result.matchDetails && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{result.matchDetails}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};
