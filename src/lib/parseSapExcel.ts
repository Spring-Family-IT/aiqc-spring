import * as XLSX from "xlsx";

interface ExcelData {
  [key: string]: string | number | null;
}

interface ParseResult {
  jsonData: ExcelData[];
  headers: string[];
}

/**
 * Parse SAP Excel files with specific format:
 * - Uses row 4 (index 3) as headers
 * - Column P (index 15) is explicitly named "Description"
 * - Forward-fills empty cells down each column
 */
export const parseSapExcel = async (arrayBuffer: ArrayBuffer): Promise<ParseResult> => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read all rows as array including empty cells
  const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  if (allRows.length <= 4) {
    throw new Error('Excel file must have at least 4 rows with headers in row 4');
  }

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
      
      // Special case: column P (index 15) should be named "Description"
      if (i === 15) {
        header = 'Description';
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

  return { jsonData, headers };
};
