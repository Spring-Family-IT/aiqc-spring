import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ExcelData {
  [key: string]: string | number | null;
}

interface CascadingDropdownsProps {
  excelFile?: File | null;
  onSelectedInputsChange?: (inputs: { column: string; value: string }[]) => void;
}

export const CascadingDropdowns = ({ excelFile, onSelectedInputsChange }: CascadingDropdownsProps) => {
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedValues, setSelectedValues] = useState<{ [key: string]: string }>({});
  const [checkedColumns, setCheckedColumns] = useState<{ [key: string]: boolean }>({});
  const [checkAll, setCheckAll] = useState(false);
  const [isPrimaryKeysComplete, setIsPrimaryKeysComplete] = useState(false);
  const { toast } = useToast();
  
  const PRIMARY_KEYS = ['Communication no.', 'Name of Dependency', 'Type'];

  // Process Excel file when it changes
  useEffect(() => {
    if (!excelFile) return;

    const processFile = async () => {
      try {
        const arrayBuffer = await excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read all rows as array including empty cells
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

        if (allRows.length > 4) {
          // Get the raw range to determine actual column count
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          const columnCount = range.e.c + 1; // +1 because it's 0-indexed

          // Use row 4 (index 3) as headers
          const row4 = allRows[3] || [];

          const headers = [];
          for (let i = 0; i < columnCount; i++) {
            let header = row4[i];
            
            // If row 4 header is null/empty, use column letter
            if (!header || String(header).trim() === '') {
              // Generate column name like Excel does (A, B, C, ..., Z, AA, AB, etc.)
              const colName = XLSX.utils.encode_col(i);
              
              // Special case: column P (index 15) should be named "Type"
              if (i === 15) {
                header = 'Type';
              } else {
                header = colName;
              }
            }
            
            headers.push(String(header));
          }
          
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

          // Forward-fill empty cells with previous non-null values
          headers.forEach((header) => {
            let lastValue: string | number | null = null;
            jsonData.forEach((row) => {
              if (row[header] !== null && row[header] !== undefined && String(row[header]).trim() !== '') {
                lastValue = row[header];
              } else if (lastValue !== null) {
                row[header] = lastValue;
              }
            });
          });

          // Filter out empty/ignored column names (N, R, W, X, Y, Z)
          const ignoredColumns = ['N', 'R', 'W', 'X', 'Y', 'Z'];
          const filteredHeaders = headers.filter(h => !ignoredColumns.includes(h));
          
          setColumns(filteredHeaders);
          setExcelData(jsonData);
          setSelectedValues({});
          setCheckedColumns({});
          setIsPrimaryKeysComplete(false);

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

    processFile();
  }, [excelFile, toast]);

  const getFilteredOptions = (columnIndex: number): string[] => {
    const column = columns[columnIndex];
    const primaryKeyIndex = PRIMARY_KEYS.indexOf(column);
    
    // If this is a primary key
    if (primaryKeyIndex !== -1) {
      if (primaryKeyIndex === 0) {
        // First primary key: show all unique values
        const uniqueValues = [...new Set(excelData.map(row => 
          String(row[column] || '').trim()
        ))];
        return uniqueValues.filter(v => v !== '').sort();
      } else {
        // Subsequent primary keys: filter based on previous primary keys
        let filteredData = [...excelData];
        
        for (let i = 0; i < primaryKeyIndex; i++) {
          const prevKey = PRIMARY_KEYS[i];
          const selectedValue = selectedValues[prevKey];
          if (selectedValue) {
            filteredData = filteredData.filter(row => {
              const rowValue = String(row[prevKey] || '').trim();
              return rowValue === selectedValue.trim();
            });
          }
        }
        
        const uniqueValues = [...new Set(filteredData.map(row => 
          String(row[column] || '').trim()
        ))];
        return uniqueValues.filter(v => v !== '').sort();
      }
    }
    
    // Non-primary key fields: return empty array (they will be auto-populated)
    return [];
  };

  const getDebugInfo = (columnIndex: number): number => {
    if (columnIndex === 0) return excelData.length;
    
    let filteredData = [...excelData];
    for (let i = 0; i < columnIndex; i++) {
      const selectedValue = selectedValues[columns[i]];
      if (selectedValue) {
        filteredData = filteredData.filter(row => {
          const rowValue = String(row[columns[i]] || '').trim();
          const selectedValueTrimmed = selectedValue.trim();
          return rowValue && selectedValueTrimmed && rowValue === selectedValueTrimmed;
        });
      }
    }
    return filteredData.length;
  };

  const autoPopulateFields = (primaryKeySelections: { [key: string]: string }) => {
    // Find the row that matches all primary key selections
    const matchingRow = excelData.find(row => {
      return PRIMARY_KEYS.every(key => {
        const rowValue = String(row[key] || '').trim();
        const selectedValue = String(primaryKeySelections[key] || '').trim();
        return rowValue === selectedValue;
      });
    });
    
    if (matchingRow) {
      // Auto-populate all fields from the matching row
      const autoPopulated: { [key: string]: string } = { ...primaryKeySelections };
      columns.forEach(col => {
        if (!PRIMARY_KEYS.includes(col)) {
          const value = matchingRow[col];
          if (value !== null && value !== undefined) {
            autoPopulated[col] = String(value);
          }
        }
      });
      
      setSelectedValues(autoPopulated);
      
      toast({
        title: "Fields auto-populated",
        description: "All fields have been filled based on your selections",
      });
    }
  };

  const handleSelectionChange = (column: string, value: string, columnIndex: number) => {
    const newSelectedValues: { [key: string]: string } = { ...selectedValues };
    newSelectedValues[column] = value;
    
    // Check if this is a primary key
    const isPrimaryKey = PRIMARY_KEYS.includes(column);
    
    if (isPrimaryKey) {
      // Clear all selections after this primary key in the PRIMARY_KEYS array
      const primaryKeyIndex = PRIMARY_KEYS.indexOf(column);
      PRIMARY_KEYS.slice(primaryKeyIndex + 1).forEach(key => {
        delete newSelectedValues[key];
      });
      
      // Clear all non-primary-key fields
      columns.forEach(col => {
        if (!PRIMARY_KEYS.includes(col)) {
          delete newSelectedValues[col];
        }
      });
    }
    
    setSelectedValues(newSelectedValues);
    
    // Check if all primary keys are selected
    const allPrimaryKeysSelected = PRIMARY_KEYS.every(key => 
      newSelectedValues[key] && newSelectedValues[key].trim() !== ''
    );
    
    setIsPrimaryKeysComplete(allPrimaryKeysSelected);
    
    // If all primary keys are selected, auto-populate other fields
    if (allPrimaryKeysSelected) {
      autoPopulateFields(newSelectedValues);
    }
  };

  const getSelectedRow = (): ExcelData | null => {
    if (Object.keys(selectedValues).length === 0) return null;

    return excelData.find(row => {
      return Object.entries(selectedValues).every(([key, value]) => {
        return String(row[key] || '').trim() === value.trim();
      });
    }) || null;
  };

  const handleCheckboxChange = (column: string, checked: boolean) => {
    const newCheckedColumns = {
      ...checkedColumns,
      [column]: checked
    };
    setCheckedColumns(newCheckedColumns);
    
    // Update checkAll state based on whether all available fields are checked
    const availableColumns = columns.filter(col => selectedValues[col]);
    const allAvailableChecked = availableColumns.every(col => newCheckedColumns[col]);
    setCheckAll(allAvailableChecked && availableColumns.length > 0);
    
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

  const handleCheckAllChange = (checked: boolean) => {
    setCheckAll(checked);
    
    if (checked) {
      // Check all fields that have selected values
      const newCheckedColumns: { [key: string]: boolean } = {};
      columns.forEach(col => {
        if (selectedValues[col]) {
          newCheckedColumns[col] = true;
        }
      });
      setCheckedColumns(newCheckedColumns);
      
      // Notify parent with all selected inputs
      const allInputs = columns
        .filter(col => selectedValues[col])
        .map(col => ({
          column: col,
          value: selectedValues[col]
        }));
      onSelectedInputsChange?.(allInputs);
    } else {
      // Uncheck all
      setCheckedColumns({});
      onSelectedInputsChange?.([]);
    }
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

  // Debug helper functions
  const filterDataUpToIndex = (columnIndex: number) => {
    let filtered = [...excelData];
    for (let i = 0; i < columnIndex; i++) {
      const selectedValue = selectedValues[columns[i]];
      if (selectedValue) {
        const selectedValueTrimmed = selectedValue.trim();
        filtered = filtered.filter(row => {
          const rowValue = String(row[columns[i]] || '').trim();
          return rowValue && selectedValueTrimmed && rowValue === selectedValueTrimmed;
        });
      }
    }
    return filtered;
  };

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildGroupedSummary = () => {
    const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

    const commIdxExact = columns.findIndex(h => eq(h, 'Communication no.'));
    const versIdxExact = columns.findIndex(h => eq(h, 'Product Version no.'));
    const nameDepIdx = columns.findIndex(h => eq(h, 'Name of Dependency'));

    const commIdxLoose = columns.findIndex(h => /communication/.test(h.toLowerCase()) && /no|number/.test(h.toLowerCase()));
    const versIdxLoose = columns.findIndex(h => /product/.test(h.toLowerCase()) && /version/.test(h.toLowerCase()));

    const commIdx = commIdxExact >= 0 ? commIdxExact : commIdxLoose;
    const versIdx = versIdxExact >= 0 ? versIdxExact : versIdxLoose;

    const summary: any = {
      headers: columns,
      indices: { commIdx, versIdx, nameDepIdx },
      groups: {} as Record<string, Record<string, any>>
    };

    if (commIdx < 0 || versIdx < 0) {
      summary.error = 'Could not locate Communication no. or Product Version no. columns in headers';
      return summary;
    }

    for (const row of excelData) {
      const comm = String(row[columns[commIdx]] ?? '').trim();
      const ver = String(row[columns[versIdx]] ?? '').trim();
      if (!comm || !ver) continue;

      summary.groups[comm] ||= {};
      const slot = (summary.groups[comm][ver] ||= {
        rowCount: 0,
        distinct: {
          name_of_dependency: [] as string[],
        },
        sampleRows: [] as any[]
      });

      slot.rowCount += 1;

      if (nameDepIdx >= 0) {
        const dep = String(row[columns[nameDepIdx]] ?? '').trim();
        if (dep && !slot.distinct.name_of_dependency.includes(dep)) {
          slot.distinct.name_of_dependency.push(dep);
        }
      }

      if (slot.sampleRows.length < 10) {
        slot.sampleRows.push(row);
      }
    }

    return summary;
  };

  const buildDebugSnapshot = () => {
    const perColumn = columns.map((col, index) => {
      const filteredAtStep = filterDataUpToIndex(index);
      const options = getFilteredOptions(index);
      return {
        column: col,
        selectedValue: selectedValues[col] || null,
        rowsMatchingUpToThisColumn: filteredAtStep.length,
        options,
        sampleRows: filteredAtStep.slice(0, 10)
      };
    });

    return {
      fileName: excelFile?.name || null,
      totalRows: excelData.length,
      headers: columns,
      selections: selectedValues,
      checkedColumns,
      perColumn
    };
  };

  const selectedRow = getSelectedRow();
  const selectedInputs = getSelectedInputs();

  const primaryKeyFields = columns.filter(col => PRIMARY_KEYS.includes(col));
  const otherFields = columns.filter(col => !PRIMARY_KEYS.includes(col));

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-semibold mb-4">SAP Fields</h2>

      {/* Check All Checkbox */}
      {columns.length > 0 && (
        <div className="mb-4 p-4 bg-accent/10 rounded-lg border border-accent/20">
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkbox-all"
              checked={checkAll}
              onCheckedChange={(checked) => handleCheckAllChange(checked as boolean)}
              disabled={columns.every(col => !selectedValues[col])}
            />
            <label
              htmlFor="checkbox-all"
              className="text-sm font-medium cursor-pointer"
            >
              Check All Fields for Comparison
            </label>
          </div>
        </div>
      )}

      {/* Primary Key Dropdowns */}
      {primaryKeyFields.length > 0 && (
        <div className="space-y-4 mb-6">
          {primaryKeyFields.map((column) => {
            const columnIndex = columns.indexOf(column);
            const options = getFilteredOptions(columnIndex);
            const primaryKeyIndex = PRIMARY_KEYS.indexOf(column);
            const isDisabled = primaryKeyIndex > 0 && !selectedValues[PRIMARY_KEYS[primaryKeyIndex - 1]];
            
            return (
              <div key={column} className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium min-w-[200px]">
                    {column}
                  </label>
                  <Select
                    value={selectedValues[column] || ''}
                    onValueChange={(value) => handleSelectionChange(column, value, columnIndex)}
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
                  <Checkbox
                    id={`checkbox-${column}`}
                    checked={checkedColumns[column] || false}
                    onCheckedChange={(checked) => handleCheckboxChange(column, checked as boolean)}
                    disabled={!selectedValues[column]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-populated Fields */}
      {isPrimaryKeysComplete && otherFields.length > 0 && (
        <div className="space-y-4 mb-6">
          {otherFields.map((column) => {
            const value = selectedValues[column] || '';
            
            return (
              <div key={column} className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium min-w-[200px]">
                    {column}
                  </label>
                  <div className="flex-1 px-3 py-2 bg-muted/50 rounded-md text-sm">
                    {value || '—'}
                  </div>
                  <Checkbox
                    id={`checkbox-${column}`}
                    checked={checkedColumns[column] || false}
                    onCheckedChange={(checked) => handleCheckboxChange(column, checked as boolean)}
                    disabled={!value}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Inputs for Function */}
      {selectedInputs.length > 0 && (
        <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <h3 className="font-semibold mb-3">Selected Fields:</h3>
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

    </Card>
  );
};
