import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Project {
  id: string;
  name: string;
}

interface ProjectsListProps {
  projects: Project[];
  isLoading?: boolean;
}

export const ProjectsList = ({ projects, isLoading }: ProjectsListProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Projects
          </CardTitle>
          <CardDescription>Loading projects...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Projects
        </CardTitle>
        <CardDescription>
          {projects.length > 0 ? `${projects.length} project${projects.length !== 1 ? 's' : ''} found` : 'Projects extracted from custom model tags'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.length === 0 ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>No projects found</strong>
              <br /><br />
              Projects are automatically extracted from custom extraction models in Azure Document Intelligence.
              <br /><br />
              <strong>Steps to create projects:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 ml-2">
                <li>Go to <a href="https://documentintelligence.ai.azure.com/" target="_blank" rel="noopener noreferrer" className="underline">Azure Document Intelligence Studio</a></li>
                <li>Create a custom extraction model</li>
                <li>Add these tags to your model:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li><code className="bg-muted px-1 py-0.5 rounded text-xs">projectId</code> - A unique identifier (e.g., "project-001")</li>
                    <li><code className="bg-muted px-1 py-0.5 rounded text-xs">projectName</code> - A display name (e.g., "Invoice Processing")</li>
                  </ul>
                </li>
                <li>Reload this page to see your projects appear</li>
              </ol>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="font-medium">{project.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  ID: {project.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
