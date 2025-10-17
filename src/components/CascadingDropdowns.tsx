import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ExcelData {
  [key: string]: string | number | null;
}

interface CascadingDropdownsProps {
  onSelectedInputsChange?: (inputs: { column: string; value: string }[]) => void;
}

export const CascadingDropdowns = ({ onSelectedInputsChange }: CascadingDropdownsProps) => {
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedValues, setSelectedValues] = useState<{ [key: string]: string }>({});
  const [checkedColumns, setCheckedColumns] = useState<{ [key: string]: boolean }>({});
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Read all rows as array
      const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (allRows.length > 4) {
        // Use 4th row (index 3) as headers
        const headers = allRows[3].map((h: any) => String(h || ''));
        
        // Get data starting from row 5 (index 4)
        const dataRows = allRows.slice(4);
        
        // Convert to object format
        const jsonData = dataRows.map(row => {
          const obj: ExcelData = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : null;
          });
          return obj;
        });

        setColumns(headers);
        setExcelData(jsonData);
        setSelectedValues({});
        setCheckedColumns({});

        toast({
          title: "Excel file loaded",
          description: `Loaded ${jsonData.length} rows with ${headers.length} columns`,
        });
      } else {
        toast({
          title: "Invalid file format",
          description: "Excel file must have at least 4 rows with headers in row 4",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast({
        title: "Error loading file",
        description: error instanceof Error ? error.message : "Failed to parse Excel file",
        variant: "destructive",
      });
    }
  };

  const getFilteredOptions = (columnIndex: number): string[] => {
    if (columnIndex === 0) {
      // First dropdown: return all unique values
      const uniqueValues = [...new Set(excelData.map(row => String(row[columns[0]] || '')))];
      return uniqueValues.filter(v => v !== '');
    }

    // For subsequent dropdowns, filter based on previous selections
    let filteredData = [...excelData];
    
    for (let i = 0; i < columnIndex; i++) {
      const selectedValue = selectedValues[columns[i]];
      if (selectedValue) {
        filteredData = filteredData.filter(row => String(row[columns[i]]) === selectedValue);
      }
    }

    const uniqueValues = [...new Set(filteredData.map(row => String(row[columns[columnIndex]] || '')))];
    return uniqueValues.filter(v => v !== '');
  };

  const handleSelectionChange = (column: string, value: string, columnIndex: number) => {
    const newSelectedValues: { [key: string]: string } = {};
    
    // Keep selections up to current column
    for (let i = 0; i <= columnIndex; i++) {
      if (i === columnIndex) {
        newSelectedValues[column] = value;
      } else if (selectedValues[columns[i]]) {
        newSelectedValues[columns[i]] = selectedValues[columns[i]];
      }
    }
    
    setSelectedValues(newSelectedValues);
  };

  const getSelectedRow = (): ExcelData | null => {
    if (Object.keys(selectedValues).length === 0) return null;

    return excelData.find(row => {
      return Object.entries(selectedValues).every(([key, value]) => {
        return String(row[key]) === value;
      });
    }) || null;
  };

  const handleCheckboxChange = (column: string, checked: boolean) => {
    const newCheckedColumns = {
      ...checkedColumns,
      [column]: checked
    };
    setCheckedColumns(newCheckedColumns);
    
    // Calculate new selected inputs and notify parent
    const newSelectedInputs = Object.entries(newCheckedColumns)
      .filter(([_, isChecked]) => isChecked)
      .map(([col]) => ({
        column: col,
        value: selectedValues[col] || ''
      }))
      .filter(item => item.value !== '');
    
    onSelectedInputsChange?.(newSelectedInputs);
  };

  const getSelectedInputs = () => {
    return Object.entries(checkedColumns)
      .filter(([_, isChecked]) => isChecked)
      .map(([column]) => ({
        column,
        value: selectedValues[column] || ''
      }))
      .filter(item => item.value !== '');
  };

  const selectedRow = getSelectedRow();
  const selectedInputs = getSelectedInputs();

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Cascading Dropdowns</h2>
      
      {/* File Upload */}
      <div className="mb-6">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="excel-upload"
        />
        <label htmlFor="excel-upload">
          <Button variant="outline" className="cursor-pointer" asChild>
            <span>
              <Upload className="w-4 h-4 mr-2" />
              {file ? file.name : "Upload Excel File"}
            </span>
          </Button>
        </label>
      </div>

      {/* Cascading Dropdowns */}
      {columns.length > 0 && (
        <div className="space-y-4">
          {columns.map((column, index) => {
            const options = getFilteredOptions(index);
            const isDisabled = index > 0 && !selectedValues[columns[index - 1]];
            
            return (
              <div key={column} className="space-y-2">
                <label className="text-sm font-medium">{column}</label>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedValues[column] || ""}
                    onValueChange={(value) => handleSelectionChange(column, value, index)}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={`Select ${column}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50 max-h-[300px]">
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`checkbox-${column}`}
                      checked={checkedColumns[column] || false}
                      onCheckedChange={(checked) => handleCheckboxChange(column, checked as boolean)}
                      disabled={!selectedValues[column]}
                    />
                    <label
                      htmlFor={`checkbox-${column}`}
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Use as input
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Inputs for Function */}
      {selectedInputs.length > 0 && (
        <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <h3 className="font-semibold mb-3">Selected Inputs for Next Function:</h3>
          <div className="space-y-2">
            {selectedInputs.map(({ column, value }) => (
              <div key={column} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-primary">{column}:</span>
                <code className="px-2 py-1 bg-background rounded text-foreground">{value}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Row Display */}
      {selectedRow && (
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Selected Row Details:</h3>
          <div className="space-y-1 text-sm">
            {Object.entries(selectedRow).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="font-medium">{key}:</span>
                <span className="text-muted-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
