// Expected versions for edge functions
// Update these whenever you modify the backend function code
export const ExpectedEdgeVersions = {
  "analyze-document": "2025-10-24-normalize-v2",
  "compare-documents": "2025-10-24-v1",
  "get-document-models": "2025-10-24-v1",
  "health-check": "2025-10-24-v1",
} as const;

export type FunctionName = keyof typeof ExpectedEdgeVersions;

export interface FunctionVersionInfo {
  name: string;
  version: string;
  buildTime: string;
}
