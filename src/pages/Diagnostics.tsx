import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const functionsBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Diagnostics = () => {
  const [log, setLog] = useState<string>("");

  const append = (obj: any) => setLog((prev) => prev + "\n" + JSON.stringify(obj, null, 2));

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

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Edge Functions Diagnostics</h1>
      <Card className="p-4 space-y-2">
        <div>Function base: /functions/v1 (using configured backend URL)</div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button onClick={testInvokeModels}>SDK invoke: get-document-models</Button>
          <Button variant="secondary" onClick={testDirectNoAuth}>Direct: models (no auth)</Button>
          <Button variant="secondary" onClick={testDirectWithAuth}>Direct: models (with auth)</Button>
          <Button variant="outline" onClick={testOptions}>OPTIONS preflight</Button>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button onClick={testInvokeHealth}>SDK invoke: health-check</Button>
          <Button variant="secondary" onClick={testDirectHealth}>Direct: health-check (no auth)</Button>
        </div>
      </Card>
      <Card className="p-4">
        <pre className="whitespace-pre-wrap text-sm">{log || "Run a test to see output..."}</pre>
      </Card>
    </div>
  );
};

export default Diagnostics;
