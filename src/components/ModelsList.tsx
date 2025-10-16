import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentModel {
  modelId: string;
  description?: string;
  createdDateTime: string;
  apiVersion?: string;
  tags?: Record<string, string>;
}

interface ModelsListProps {
  models: DocumentModel[];
}

export const ModelsList = ({ models }: ModelsListProps) => {
  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Models Found</CardTitle>
          <CardDescription>
            No document models are available in your Azure resource.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Separate custom and prebuilt models
  const customModels = models.filter(model => !model.modelId.startsWith('prebuilt-'));
  const prebuiltModels = models.filter(model => model.modelId.startsWith('prebuilt-'));

  const ModelCard = ({ model }: { model: DocumentModel }) => (
    <Card key={model.modelId}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{model.modelId}</CardTitle>
          {model.modelId.startsWith('prebuilt-') && (
            <Badge variant="secondary">Prebuilt</Badge>
          )}
        </div>
        {model.description && (
          <CardDescription>{model.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(model.createdDateTime).toLocaleDateString()}</span>
          </div>
          {model.apiVersion && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Version:</span>
              <span>{model.apiVersion}</span>
            </div>
          )}
          {model.tags && Object.keys(model.tags).length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {Object.entries(model.tags).map(([key, value]) => (
                <Badge key={key} variant="outline">
                  {key}: {value}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Models</CardTitle>
        <CardDescription>
          Custom extraction models trained for specific document types
        </CardDescription>
      </CardHeader>
      <CardContent>
        {customModels.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Custom Extraction Models ({customModels.length})
                </h3>
              </div>
              {customModels.map((model) => (
                <ModelCard key={model.modelId} model={model} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No custom extraction models found</p>
            <p className="text-sm">Create custom models in Azure Document Intelligence Studio to see them here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
