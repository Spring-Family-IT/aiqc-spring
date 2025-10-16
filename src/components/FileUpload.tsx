import { Upload, FileText, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onExcelSelect?: (file: File) => void;
  pdfFile: File | null;
  excelFile?: File | null;
}

export const FileUpload = ({ onFileSelect, onExcelSelect, pdfFile, excelFile }: FileUploadProps) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      onFileSelect(file);
    } else if (file && (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel")) {
      onExcelSelect?.(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleExcelInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onExcelSelect?.(file);
    }
  };

  return (
    <div className="flex justify-center gap-4">
      {/* PDF Upload */}
      <Card
        className={cn(
          "relative border-2 border-dashed transition-all duration-300 hover:border-primary cursor-pointer w-full max-w-md",
          pdfFile ? "border-success bg-success/5" : "border-muted"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
          <input
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
            {pdfFile ? pdfFile.name : "Upload PDF Document"}
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            {pdfFile 
              ? "Click to change file"
              : "Drag and drop or click to browse"}
          </p>
        </label>
      </Card>

      {/* Excel Upload */}
      {onExcelSelect && (
        <Card
          className={cn(
            "relative border-2 border-dashed transition-all duration-300 hover:border-primary cursor-pointer w-full max-w-md",
            excelFile ? "border-success bg-success/5" : "border-muted"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
            <input
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
              {excelFile ? excelFile.name : "Upload Excel File"}
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              {excelFile 
                ? "Click to change file"
                : "Drag and drop or click to browse"}
            </p>
          </label>
        </Card>
      )}
    </div>
  );
};
