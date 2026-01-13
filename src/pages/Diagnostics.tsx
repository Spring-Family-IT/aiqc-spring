import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SUPABASE_CONFIG } from "@/config/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExpectedEdgeVersions, FunctionName, FunctionVersionInfo } from "@/config/edgeVersions";
import { CheckCircle, XCircle } from "lucide-react";

const functionsBase = `${SUPABASE_CONFIG.url}/functions/v1`;
const anonKey = SUPABASE_CONFIG.anonKey;

// Minimal valid PDF (base64) - just says "TEST"
const MOCK_PDF_BASE64 = "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4vTWVkaWFCb3ggWzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZAooVEVTVCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+CmVuZG9iagoxIDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyNzQgMDAwMDAgbiAKMDAwMDAwMDIzMyAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMjYgMDAwMDAgbiAKMDAwMDAwMDE5NSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjMyMwolJUVPRg==";

const Diagnostics = () => {
  const [log, setLog] = useState<string>("");
  const [versions, setVersions] = useState<Record<string, FunctionVersionInfo | null>>({});
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});

  const append = (obj: any) => setLog((prev) => prev + "\n" + JSON.stringify(obj, null, 2));

  const checkFunctionVersion = async (functionName: FunctionName) => {
    setLoadingVersions(prev => ({ ...prev, [functionName]: true }));
    append({ test: `Checking ${functionName} version (GET)` });
    
    try {
      const res = await fetch(`${functionsBase}/${functionName}`, {
        method: "GET",
        headers: {
          "apikey": anonKey,
        },
      });
      
      const json = await res.json();
      append({ status: res.status, ok: res.ok, version: json });
      
      if (res.ok && json.name && json.version) {
        setVersions(prev => ({ ...prev, [functionName]: json }));
      } else {
        setVersions(prev => ({ ...prev, [functionName]: null }));
      }
    } catch (e) {
      append({ fetchError: String(e) });
      setVersions(prev => ({ ...prev, [functionName]: null }));
    } finally {
      setLoadingVersions(prev => ({ ...prev, [functionName]: false }));
    }
  };

  const checkAllVersions = async () => {
    setLog("");
    append({ test: "Checking all function versions..." });
    const functions: FunctionName[] = ["analyze-document", "compare-documents", "get-document-models", "health-check"];
    for (const fn of functions) {
      await checkFunctionVersion(fn);
    }
  };

  const createMockPDF = () => {
    const binaryString = atob(MOCK_PDF_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  };

  const testInvokeModels = async () => {
    setLog("");
    append({ test: "SDK invoke get-document-models" });
    const { data, error } = await supabase.functions.invoke("get-document-models", { body: {} });
    if (error) append({ error: { name: error.name, message: error.message } });
    else append({ data });
  };

  const testDirectNoAuth = async () => {
    setLog("");
    append({ test: "Direct fetch (no auth) get-document-models" });
    try {
      const res = await fetch(`${functionsBase}/get-document-models`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
        },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      append({ status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()) });
      try { append({ json: JSON.parse(text) }); } catch { append({ body: text }); }
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  const testDirectWithAuth = async () => {
    setLog("");
    append({ test: "Direct fetch (with auth) get-document-models" });
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    try {
      const res = await fetch(`${functionsBase}/get-document-models`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          ...(token ? { "authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      append({ status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()) });
      try { append({ json: JSON.parse(text) }); } catch { append({ body: text }); }
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  const testOptions = async () => {
    setLog("");
    append({ test: "OPTIONS preflight get-document-models" });
    try {
      const res = await fetch(`${functionsBase}/get-document-models`, { method: "OPTIONS" as const });
      append({ status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()) });
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  const testInvokeHealth = async () => {
    setLog("");
    append({ test: "SDK invoke health-check" });
    const { data, error } = await supabase.functions.invoke("health-check", { body: {} });
    if (error) append({ error: { name: error.name, message: error.message } });
    else append({ data });
  };

  const testDirectHealth = async () => {
    setLog("");
    append({ test: "Direct fetch (no auth) health-check" });
    try {
      const res = await fetch(`${functionsBase}/health-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": anonKey },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      append({ status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), json });
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  // Analyze Document tests
  const testInvokeAnalyze = async () => {
    setLog("");
    append({ test: "SDK invoke analyze-document" });
    const formData = new FormData();
    formData.append('pdfFile', createMockPDF(), 'test.pdf');
    formData.append('modelId', 'prebuilt-read');
    
    const { data, error } = await supabase.functions.invoke("analyze-document", { body: formData });
    if (error) append({ error: { name: error.name, message: error.message } });
    else append({ data });
  };

  const testDirectAnalyzeNoAuth = async () => {
    setLog("");
    append({ test: "Direct fetch (no auth) analyze-document" });
    try {
      const formData = new FormData();
      formData.append('pdfFile', createMockPDF(), 'test.pdf');
      formData.append('modelId', 'prebuilt-read');
      
      const res = await fetch(`${functionsBase}/analyze-document`, {
        method: "POST",
        headers: { "apikey": anonKey },
        body: formData,
      });
      const text = await res.text();
      append({ status: res.status, ok: res.ok });
      try { append({ json: JSON.parse(text) }); } catch { append({ body: text }); }
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  const testDirectAnalyzeWithAuth = async () => {
    setLog("");
    append({ test: "Direct fetch (with auth) analyze-document" });
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    try {
      const formData = new FormData();
      formData.append('pdfFile', createMockPDF(), 'test.pdf');
      formData.append('modelId', 'prebuilt-read');
      
      const res = await fetch(`${functionsBase}/analyze-document`, {
        method: "POST",
        headers: {
          "apikey": anonKey,
          ...(token ? { "authorization": `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const text = await res.text();
      append({ status: res.status, ok: res.ok });
      try { append({ json: JSON.parse(text) }); } catch { append({ body: text }); }
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  // Compare Documents tests
  const testInvokeCompare = async () => {
    setLog("");
    append({ test: "SDK invoke compare-documents" });
    const formData = new FormData();
    formData.append('pdfFile', createMockPDF(), 'test.pdf');
    formData.append('modelId', 'prebuilt-invoice');
    formData.append('excelData', JSON.stringify([[{ field: "test", value: "mock" }]]));
    
    const { data, error } = await supabase.functions.invoke("compare-documents", { body: formData });
    if (error) append({ error: { name: error.name, message: error.message } });
    else append({ data });
  };

  const testDirectCompareNoAuth = async () => {
    setLog("");
    append({ test: "Direct fetch (no auth) compare-documents" });
    try {
      const formData = new FormData();
      formData.append('pdfFile', createMockPDF(), 'test.pdf');
      formData.append('modelId', 'prebuilt-invoice');
      formData.append('excelData', JSON.stringify([[{ field: "test", value: "mock" }]]));
      
      const res = await fetch(`${functionsBase}/compare-documents`, {
        method: "POST",
        headers: { "apikey": anonKey },
        body: formData,
      });
      const text = await res.text();
      append({ status: res.status, ok: res.ok });
      try { append({ json: JSON.parse(text) }); } catch { append({ body: text }); }
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  const testDirectCompareWithAuth = async () => {
    setLog("");
    append({ test: "Direct fetch (with auth) compare-documents" });
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    try {
      const formData = new FormData();
      formData.append('pdfFile', createMockPDF(), 'test.pdf');
      formData.append('modelId', 'prebuilt-invoice');
      formData.append('excelData', JSON.stringify([[{ field: "test", value: "mock" }]]));
      
      const res = await fetch(`${functionsBase}/compare-documents`, {
        method: "POST",
        headers: {
          "apikey": anonKey,
          ...(token ? { "authorization": `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const text = await res.text();
      append({ status: res.status, ok: res.ok });
      try { append({ json: JSON.parse(text) }); } catch { append({ body: text }); }
    } catch (e) {
      append({ fetchError: String(e) });
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Edge Functions Diagnostics</h1>
      
      {/* Version and Deploy Status */}
      <Card className="p-4 space-y-2">
        <h2 className="text-lg font-semibold">Version and Deploy Status</h2>
        <div className="text-sm text-muted-foreground">Check which backend versions are currently deployed</div>
        <Separator />
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={checkAllVersions}>Check All Versions</Button>
          <Button variant="secondary" onClick={() => checkFunctionVersion("analyze-document")}>
            Check analyze-document
          </Button>
          <Button variant="secondary" onClick={() => checkFunctionVersion("compare-documents")}>
            Check compare-documents
          </Button>
          <Button variant="secondary" onClick={() => checkFunctionVersion("get-document-models")}>
            Check get-document-models
          </Button>
          <Button variant="secondary" onClick={() => checkFunctionVersion("health-check")}>
            Check health-check
          </Button>
        </div>
        
        {/* Version Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(ExpectedEdgeVersions) as FunctionName[]).map((fn) => {
            const expected = ExpectedEdgeVersions[fn];
            const actual = versions[fn];
            const isMatch = actual?.version === expected;
            const isLoading = loadingVersions[fn];
            
            return (
              <div key={fn} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{fn}</span>
                  {!isLoading && actual && (
                    isMatch ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )
                  )}
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="text-muted-foreground">
                    Expected: <span className="font-mono">{expected}</span>
                  </div>
                  {actual ? (
                    <>
                      <div className={isMatch ? "text-green-600" : "text-red-600"}>
                        Actual: <span className="font-mono">{actual.version}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Built: {new Date(actual.buildTime).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">
                      {isLoading ? "Loading..." : "Not checked yet"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      
      {/* Model Fetching Functions */}
      <Card className="p-4 space-y-2">
        <h2 className="text-lg font-semibold">Model Fetching Functions</h2>
        <div className="text-sm text-muted-foreground">Test get-document-models function</div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button onClick={testInvokeModels}>SDK invoke</Button>
          <Button variant="secondary" onClick={testDirectNoAuth}>Direct (no auth)</Button>
          <Button variant="secondary" onClick={testDirectWithAuth}>Direct (with auth)</Button>
          <Button variant="outline" onClick={testOptions}>OPTIONS preflight</Button>
        </div>
      </Card>

      {/* Document Processing Functions */}
      <Card className="p-4 space-y-2">
        <h2 className="text-lg font-semibold">Document Processing Functions</h2>
        <div className="text-sm text-muted-foreground">Test analyze-document and compare-documents with mock PDF data</div>
        <Separator />
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-2">analyze-document (uses prebuilt-read model)</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={testInvokeAnalyze}>SDK invoke</Button>
              <Button variant="secondary" onClick={testDirectAnalyzeNoAuth}>Direct (no auth)</Button>
              <Button variant="secondary" onClick={testDirectAnalyzeWithAuth}>Direct (with auth)</Button>
            </div>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">compare-documents (uses prebuilt-invoice model)</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={testInvokeCompare}>SDK invoke</Button>
              <Button variant="secondary" onClick={testDirectCompareNoAuth}>Direct (no auth)</Button>
              <Button variant="secondary" onClick={testDirectCompareWithAuth}>Direct (with auth)</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Infrastructure Functions */}
      <Card className="p-4 space-y-2">
        <h2 className="text-lg font-semibold">Infrastructure Functions</h2>
        <div className="text-sm text-muted-foreground">Test health-check endpoint</div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button onClick={testInvokeHealth}>SDK invoke</Button>
          <Button variant="secondary" onClick={testDirectHealth}>Direct (no auth)</Button>
        </div>
      </Card>

      {/* Output Log */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">Test Output</h2>
        <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md min-h-[200px]">
          {log || "Run a test to see output..."}
        </pre>
      </Card>
    </div>
  );
};

export default Diagnostics;
