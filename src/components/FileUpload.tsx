import { Upload, FileText, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  onExcelSelect?: (file: File) => void;
  pdfFile?: File | null;
  excelFile?: File | null;
  onValidationError?: (message: string) => void;
}

export const FileUpload = ({ onFileSelect, onExcelSelect, pdfFile, excelFile, onValidationError }: FileUploadProps) => {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      onFileSelect?.(file);
    } else if (file && (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel")) {
      onExcelSelect?.(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (4MB = 4 * 1024 * 1024 bytes)
      const maxSize = 4 * 1024 * 1024;
      if (file.size > maxSize) {
        onValidationError?.("File size exceeds 4MB. Please upload a smaller PDF file.");
        e.target.value = ''; // Reset input
        return;
      }
      onFileSelect?.(file);
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
        <Card
          className={cn(
            "relative border-2 border-dashed transition-all duration-300 hover:border-primary cursor-pointer w-full max-w-md min-h-[240px]",
            pdfFile ? "border-success bg-success/5" : "border-muted"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
            />
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
              pdfFile ? "bg-success/20" : "bg-primary/10"
            )}>
              {pdfFile ? (
                <FileText className="w-8 h-8 text-success" />
              ) : (
                <Upload className="w-8 h-8 text-primary" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {pdfFile ? pdfFile.name : "Upload your Package File (PDF)"}
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              {pdfFile 
                ? "Click to change file"
                : "The file for QC should be a low-res PDF, less than 4MB."}
            </p>
          </label>
        </Card>
      )}

      {/* Excel Upload - Only show if onExcelSelect is provided */}
      {onExcelSelect && (
        <Card
          className={cn(
            "relative border-2 border-dashed transition-all duration-300 hover:border-primary cursor-pointer w-full max-w-lg min-h-[240px]",
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
