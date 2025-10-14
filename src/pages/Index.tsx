import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Download, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface ExcelData {
  columns: string[];
  rows: any[];
}

interface SearchResult {
  element: string;
  found: boolean;
  matchedIn?: any;
}

const Index = () => {
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedJSON, setUploadedJSON] = useState<any[] | null>(null);
  const [jsonFileName, setJsonFileName] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchKey, setSearchKey] = useState<string>("MDP703b - Product Labeling Data Ext.");

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

    // Track last non-empty values for all columns
    let lastMDP703b = "";
    let lastCommNo = "";
    let lastEmpty2 = "";

    const filteredData = excelData.rows.map((row) => {
      // Fill forward logic for all columns
      const mdp703bValue = row["MDP703b - Product Labeling Data Ext."];
      if (mdp703bValue !== undefined && mdp703bValue !== null && mdp703bValue !== "") {
        lastMDP703b = mdp703bValue;
      }

      const commNoValue = row["Communication no."];
      if (commNoValue !== undefined && commNoValue !== null && commNoValue !== "") {
        lastCommNo = commNoValue;
      }

      const empty2Value = row["__EMPTY_2"];
      if (empty2Value !== undefined && empty2Value !== null && empty2Value !== "") {
        lastEmpty2 = empty2Value;
      }

      // Always include three keys with fill-forward values
      return {
        "MDP703b - Product Labeling Data Ext.": lastMDP703b,
        "Communication no.": lastCommNo,
        "__EMPTY_2": lastEmpty2
      };
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

  const handleJSONUpload = (file: File) => {
    if (!file.name.match(/\.json$/)) {
      toast.error("Please upload a valid JSON file");
      return;
    }

    setJsonFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (Array.isArray(jsonData)) {
          setUploadedJSON(jsonData);
          toast.success("JSON file uploaded successfully!");
        } else {
          toast.error("JSON file must contain an array");
        }
      } catch (error) {
        toast.error("Failed to parse JSON file");
        console.error(error);
      }
    };

    reader.readAsText(file);
  };

  const searchInJSON = () => {
    if (!excelData || !uploadedJSON || !searchKey) {
      toast.error("Please ensure both files are uploaded and a search key is selected");
      return;
    }

    // Generate the Excel JSON data first
    let lastMDP703b = "";
    let lastCommNo = "";
    let lastEmpty2 = "";

    const excelJsonData = excelData.rows.map((row) => {
      const mdp703bValue = row["MDP703b - Product Labeling Data Ext."];
      if (mdp703bValue !== undefined && mdp703bValue !== null && mdp703bValue !== "") {
        lastMDP703b = mdp703bValue;
      }

      const commNoValue = row["Communication no."];
      if (commNoValue !== undefined && commNoValue !== null && commNoValue !== "") {
        lastCommNo = commNoValue;
      }

      const empty2Value = row["__EMPTY_2"];
      if (empty2Value !== undefined && empty2Value !== null && empty2Value !== "") {
        lastEmpty2 = empty2Value;
      }

      return {
        "MDP703b - Product Labeling Data Ext.": lastMDP703b,
        "Communication no.": lastCommNo,
        "__EMPTY_2": lastEmpty2
      };
    });

    // Search for each element in uploaded JSON
    const results: SearchResult[] = excelJsonData.map((item) => {
      const elementValue = item[searchKey];
      const found = uploadedJSON.some((jsonItem) => 
        JSON.stringify(jsonItem).toLowerCase().includes(String(elementValue).toLowerCase())
      );
      
      const matchedItem = found 
        ? uploadedJSON.find((jsonItem) => 
            JSON.stringify(jsonItem).toLowerCase().includes(String(elementValue).toLowerCase())
          )
        : undefined;

      return {
        element: elementValue,
        found,
        matchedIn: matchedItem
      };
    });

    setSearchResults(results);
    toast.success(`Search complete! Found ${results.filter(r => r.found).length} matches out of ${results.length}`);
  };

  const reset = () => {
    setExcelData(null);
    setSelectedColumns([]);
    setFileName("");
    setUploadedJSON(null);
    setJsonFileName("");
    setSearchResults([]);
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

              <div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  id="excel-file-input"
                />
                <Button 
                  size="lg" 
                  className="text-lg px-8"
                  onClick={() => document.getElementById('excel-file-input')?.click()}
                >
                  <FileSpreadsheet className="mr-2 h-5 w-5" />
                  Choose File
                </Button>
              </div>

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
                      (() => {
                        let lastMDP703b = "";
                        let lastCommNo = "";
                        let lastEmpty2 = "";
                        return excelData.rows.slice(0, 3).map((row) => {
                          const mdp703bValue = row["MDP703b - Product Labeling Data Ext."];
                          if (mdp703bValue !== undefined && mdp703bValue !== null && mdp703bValue !== "") {
                            lastMDP703b = mdp703bValue;
                          }
                          const commNoValue = row["Communication no."];
                          if (commNoValue !== undefined && commNoValue !== null && commNoValue !== "") {
                            lastCommNo = commNoValue;
                          }
                          const empty2Value = row["__EMPTY_2"];
                          if (empty2Value !== undefined && empty2Value !== null && empty2Value !== "") {
                            lastEmpty2 = empty2Value;
                          }
                          return {
                            "MDP703b - Product Labeling Data Ext.": lastMDP703b,
                            "Communication no.": lastCommNo,
                            "__EMPTY_2": lastEmpty2
                          };
                        });
                      })(),
                      null,
                      2
                    )}
                    {excelData.rows.length > 3 && "\n  ..."}
                  </pre>
                </div>
              </Card>
            )}

            <Card className="p-6 border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-xl font-semibold mb-4">Compare with JSON File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a JSON file to search for elements from your Excel data
              </p>

              <div className="space-y-4">
                {!uploadedJSON ? (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleJSONUpload(file);
                      }}
                      className="hidden"
                    />
                    <Button variant="outline" size="lg" className="w-full">
                      <Upload className="mr-2 h-5 w-5" />
                      Upload JSON File
                    </Button>
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">{jsonFileName}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setUploadedJSON(null);
                          setJsonFileName("");
                          setSearchResults([]);
                        }}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Search by column:</label>
                      <select 
                        className="w-full p-2 border rounded-md bg-background"
                        value={searchKey}
                        onChange={(e) => setSearchKey(e.target.value)}
                      >
                        <option value="MDP703b - Product Labeling Data Ext.">MDP703b - Product Labeling Data Ext.</option>
                        <option value="Communication no.">Communication no.</option>
                        <option value="__EMPTY_2">__EMPTY_2</option>
                      </select>
                    </div>

                    <Button 
                      onClick={searchInJSON}
                      className="w-full gap-2"
                    >
                      <Search className="h-5 w-5" />
                      Search in JSON
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {searchResults.length > 0 && (
              <Card className="p-6 border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-semibold mb-4">Search Results</h3>
                <div className="space-y-2 max-h-96 overflow-auto">
                  {searchResults.map((result, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.found 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-red-500/10 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{result.element}</span>
                        <span className={`text-xs font-semibold ${
                          result.found ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {result.found ? '✓ Found' : '✗ Not Found'}
                        </span>
                      </div>
                      {result.found && result.matchedIn && (
                        <pre className="mt-2 text-xs bg-background/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.matchedIn, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
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
