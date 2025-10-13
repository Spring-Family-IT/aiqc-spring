import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface ExcelData {
  columns: string[];
  rows: any[];
}

const Index = () => {
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length > 0) {
          const columns = Object.keys(jsonData[0] as object);
          setExcelData({
            columns,
            rows: jsonData,
          });
          setSelectedColumns(columns);
          toast.success("Excel file loaded successfully!");
        } else {
          toast.error("The Excel file appears to be empty");
        }
      } catch (error) {
        toast.error("Failed to parse Excel file");
        console.error(error);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((col) => col !== column)
        : [...prev, column]
    );
  };

  const generateJSON = () => {
    if (!excelData || selectedColumns.length === 0) {
      toast.error("Please select at least one column");
      return;
    }

    const filteredData = excelData.rows.map((row) => {
      const filtered: any = {};
      selectedColumns.forEach((col) => {
        filtered[col] = row[col];
      });
      return filtered;
    });

    const jsonString = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.(xlsx|xls)$/, ".json");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("JSON file downloaded successfully!");
  };

  const reset = () => {
    setExcelData(null);
    setSelectedColumns([]);
    setFileName("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <header className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Excel to JSON Converter
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your Excel file, select the columns you need, and generate a clean JSON file
          </p>
        </header>

        {!excelData ? (
          <Card 
            className="max-w-2xl mx-auto p-8 md:p-12 border-2 transition-all duration-300 hover:shadow-lg animate-in fade-in slide-in-from-bottom-6 duration-700"
            style={{ 
              borderColor: isDragging ? "hsl(var(--primary))" : undefined,
              boxShadow: isDragging ? "var(--shadow-glow)" : undefined 
            }}
          >
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="text-center space-y-6"
            >
              <div className="flex justify-center">
                <div className="p-6 rounded-full bg-primary/10 transition-transform duration-300 hover:scale-110">
                  <Upload className="w-12 h-12 text-primary" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-semibold mb-2">Upload Excel File</h2>
                <p className="text-muted-foreground mb-6">
                  Drag and drop your file here, or click to browse
                </p>
              </div>

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <Button size="lg" className="text-lg px-8">
                  <FileSpreadsheet className="mr-2 h-5 w-5" />
                  Choose File
                </Button>
              </label>

              <p className="text-sm text-muted-foreground">
                Supports .xlsx and .xls files
              </p>
            </div>
          </Card>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <Card className="p-6 border-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="font-semibold text-lg">{fileName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {excelData.rows.length} rows • {excelData.columns.length} columns
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={reset}>
                  Upload New File
                </Button>
              </div>
            </Card>

            <Card className="p-6 border-2">
              <h3 className="text-xl font-semibold mb-4">Select Columns</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Choose which columns to include in your JSON output
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {excelData.columns.map((column) => (
                  <div
                    key={column}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <Checkbox
                      id={column}
                      checked={selectedColumns.includes(column)}
                      onCheckedChange={() => toggleColumn(column)}
                    />
                    <label
                      htmlFor={column}
                      className="text-sm font-medium cursor-pointer flex-1 select-none"
                    >
                      {column}
                    </label>
                    {selectedColumns.includes(column) && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-between items-center pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                  {selectedColumns.length} of {excelData.columns.length} columns selected
                </p>
                <Button 
                  size="lg" 
                  onClick={generateJSON}
                  disabled={selectedColumns.length === 0}
                  className="gap-2"
                >
                  <Download className="h-5 w-5" />
                  Generate JSON
                </Button>
              </div>
            </Card>

            {selectedColumns.length > 0 && (
              <Card className="p-6 border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-lg font-semibold mb-3">Preview</h3>
                <div className="bg-secondary/50 p-4 rounded-lg max-h-64 overflow-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(
                      excelData.rows.slice(0, 3).map((row) => {
                        const filtered: any = {};
                        selectedColumns.forEach((col) => {
                          filtered[col] = row[col];
                        });
                        return filtered;
                      }),
                      null,
                      2
                    )}
                    {excelData.rows.length > 3 && "\n  ..."}
                  </pre>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
