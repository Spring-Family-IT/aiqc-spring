import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Package, Database } from "lucide-react";

interface ResourceDetailsProps {
  endpoint: string;
  apiVersion: string;
  customModels: number;
}

export const ResourceDetails = ({ 
  endpoint, 
  apiVersion, 
  customModels 
}: ResourceDetailsProps) => {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          <CardTitle>Azure Resource Details</CardTitle>
        </div>
        <CardDescription>
          Connected Azure Document Intelligence configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Database className="w-4 h-4" />
              Endpoint
            </div>
            <p className="text-sm font-mono bg-muted p-2 rounded break-all">
              {endpoint}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="w-4 h-4" />
              API Version
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {apiVersion}
              </Badge>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Custom Extraction Models</h4>
          <div className="flex justify-center">
            <div className="text-center p-4 bg-muted rounded-lg min-w-[200px]">
              <div className="text-3xl font-bold text-primary">{customModels}</div>
              <div className="text-sm text-muted-foreground mt-1">Custom Models Available</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};