import { Upload, FileText, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface FileUploadProps {
  onFileSelect?: (files: File[]) => void;
  onExcelSelect?: (file: File) => void;
  pdfFiles?: File[];
  excelFile?: File | null;
  onValidationError?: (message: string) => void;
  onRemovePdf?: (index: number) => void;
}

export const FileUpload = ({ onFileSelect, onExcelSelect, pdfFiles, excelFile, onValidationError, onRemovePdf }: FileUploadProps) => {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    const pdfFiles = files.filter(f => f.type === "application/pdf");
    if (pdfFiles.length > 0) {
      onFileSelect?.(pdfFiles);
    }
    
    const excelFile = files.find(f => 
      f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      f.type === "application/vnd.ms-excel"
    );
    if (excelFile) {
      onExcelSelect?.(excelFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles: File[] = [];
      const maxSize = 4 * 1024 * 1024; // 4MB
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > maxSize) {
          onValidationError?.(`File "${file.name}" exceeds 4MB. Skipping.`);
          continue;
        }
        validFiles.push(file);
      }
      
      if (validFiles.length > 0) {
        onFileSelect?.(validFiles);
      }
      // Reset input value to allow re-upload of same file
      e.target.value = '';
    }
  };

  const handleExcelInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onExcelSelect?.(file);
      // Reset input value to allow re-upload of same file
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      {/* PDF Upload - Only show if onFileSelect is provided */}
      {onFileSelect && (
        <div className="space-y-4">
          <Card
            className={cn(
              "relative border-2 border-dashed transition-all duration-300 hover:border-primary cursor-pointer w-full max-w-md min-h-[180px]",
              pdfFiles && pdfFiles.length > 0 ? "border-success bg-success/5" : "border-muted"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
                pdfFiles && pdfFiles.length > 0 ? "bg-success/20" : "bg-primary/10"
              )}>
                {pdfFiles && pdfFiles.length > 0 ? (
                  <FileText className="w-8 h-8 text-success" />
                ) : (
                  <Upload className="w-8 h-8 text-primary" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {pdfFiles && pdfFiles.length > 0 
                  ? `${pdfFiles.length} PDF file(s) selected` 
                  : "Upload Multiple Package Files (PDF)"}
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                {pdfFiles && pdfFiles.length > 0
                  ? "Click to add more files"
                  : "Select multiple low-res PDF files, each less than 4MB."}
              </p>
            </label>
          </Card>
          
          {/* List of uploaded PDFs */}
          {pdfFiles && pdfFiles.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3">Uploaded Files:</h4>
              <div className="space-y-2">
                {pdfFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePdf?.(index)}
                      className="shrink-0 ml-2"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Excel Upload - Only show if onExcelSelect is provided */}
      {onExcelSelect && (
        <Card
          className={cn(
            "relative border-2 border-dashed transition-all duration-300 hover:border-primary cursor-pointer w-full max-w-lg min-h-[180px]",
            excelFile ? "border-success bg-success/5" : "border-muted"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelInput}
            />
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
              excelFile ? "bg-success/20" : "bg-primary/10"
            )}>
              {excelFile ? (
                <FileSpreadsheet className="w-8 h-8 text-success" />
              ) : (
                <Upload className="w-8 h-8 text-primary" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {excelFile ? excelFile.name : "Upload your SAP Data only."}
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              {excelFile 
                ? "Click to change file"
                : "The file for QC Data should be only Excel files, copied from SAP."}
            </p>
          </label>
        </Card>
      )}
    </div>
  );
};
