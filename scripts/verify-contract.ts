#!/usr/bin/env tsx
/**
 * verify-contract.ts
 *
 * Verifies that the Go Provider interface (`internal/provider/interface.go`)
 * and the TypeScript IProvider interface (`packages/wrapper/src/providers/interface.ts`)
 * remain in sync.
 *
 * Run: npx tsx scripts/verify-contract.ts
 * CI : exits 0 on consistent, exits 1 on drift detected
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

interface Method {
  name: string;
  params: string[];   // e.g. ["ctx context.Context"]
  returns: string[]; // e.g. ["error"]
}

// ── Parsers ────────────────────────────────────────────────────────────────

function parseGoInterface(content: string): Method[] {
  const methods: Method[] = [];
  // Extract the Provider interface block
  const blockMatch = content.match(/type Provider interface\s*\{([\s\S]*?)\}/);
  if (!blockMatch) return methods;

  const block = blockMatch[1];
  // Match each method: Name() OR Name(args) returns
  const methodRe = /^\s*(\w+)\s*\(([\w\s,.*]*?)\)\s*(.*?)[\s(]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = methodRe.exec(block)) !== null) {
    const name = m[1];
    const paramsRaw = m[2].trim();
    const returnsRaw = m[3].trim();

    const params = paramsRaw ? paramsRaw.split(",").map((p) => p.trim()) : [];
    const returns = returnsRaw
      ? returnsRaw.replace(/^\(([\s\S]*?)\)$/, "$1").split(",").map((r) => r.trim())
      : [];

    methods.push({ name, params, returns });
  }
  return methods;
}

function parseTypeScriptInterface(content: string): Method[] {
  const methods: Method[] = [];

  // Extract the IProvider interface block
  const blockMatch = content.match(/export interface IProvider\s*\{([\s\S]*?)\}/);
  if (!blockMatch) return methods;

  const block = blockMatch[1];

  // Match method signatures: name(): ReturnType OR name(args): ReturnType
  // Parameters may contain complex types with generics, union types, etc.
  const methodRe = /^\s*(\w+)\s*\(([^\)]*)\)\s*:\s*([^\n;]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = methodRe.exec(block)) !== null) {
    const name = m[1];
    const paramsRaw = m[2] ?? "";
    const returns = [m[3].trim()];
    const params = paramsRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    methods.push({ name, params, returns });
  }

  // Also capture readonly field declarations: readonly name: Type;
  const fieldRe = /^\s*readonly\s+(\w+)\s*:\s*([^\n;]+)/gm;
  while ((m = fieldRe.exec(block)) !== null) {
    const name = m[1];
    const fieldType = m[2].trim();
    methods.push({ name, params: [], returns: [fieldType] });
  }

  return methods;
}

// ── Comparison ─────────────────────────────────────────────────────────────

// Mapping from Go method name → [TypeScript counterpart, description]
// This is the canonical truth for which methods must stay in sync.
// Go uses PascalCase, TypeScript uses camelCase for methods.
const GO_TO_TS_MAP: Record<string, { tsName: string; isField?: boolean; goOnly?: boolean }> = {
  // Provider method → TypeScript equivalent
  Name:           { tsName: "key",          isField: true,  description: "Go: Name() vs TS: key field" },
  Binary:         { tsName: "",             goOnly: true,  description: "Go-only: Binary() — TS resolves binary via which() in provider invoke() implementation" },
  IsAvailable:    { tsName: "isAvailable",  isField: false, description: "Go: IsAvailable() vs TS: isAvailable()" },
  InstallHint:    { tsName: "installHint",  isField: true,  description: "Go: InstallHint() vs TS: installHint field" },
  BuildArgs:      { tsName: "buildArgs",    isField: false, description: "Go: BuildArgs(...) vs TS: buildArgs(...)" },
  IsAuthFailure:  { tsName: "",             goOnly: true,  description: "Go-only: IsAuthFailure() — TS runner classifies via exit code" },
  AuthHint:       { tsName: "",              goOnly: true,  description: "Go-only: AuthHint() — not exposed to TS" },
  CheckAuth:      { tsName: "checkAuth",    isField: false, description: "Go: CheckAuth(ctx) vs TS: checkAuth()" },
};

// TypeScript-only members that have no Go counterpart
const TS_ONLY = new Set(["key", "installHint", "onPid", "permissionProfile", "sessionId"]);

function checkDrift(goMethods: Method[], tsMethods: Method[]): string[] {
  const errors: string[] = [];

  const goMap = new Map(goMethods.map((m) => [m.name, m]));
  const tsMap = new Map(tsMethods.map((m) => [m.name, m]));

  // Go → TypeScript: every Go method should have a TS counterpart (or be Go-only)
  for (const go of goMethods) {
    const mapping = GO_TO_TS_MAP[go.name];
    if (!mapping) {
      errors.push(`[DRIFT] Go method "${go.name}()" has no entry in GO_TO_TS_MAP — document it`);
      continue;
    }
    if (mapping.goOnly) {
      // Go-only — expected, skip
      continue;
    }
    if (mapping.isField) {
      // Field: TS should have the property
      const ts = tsMap.get(mapping.tsName);
      if (!ts) {
        errors.push(`[DRIFT] Go method "${go.name}()" maps to TS field "${mapping.tsName}" but not found`);
      }
    } else {
      // Method: TS should have the method
      const ts = tsMap.get(mapping.tsName);
      if (!ts) {
        errors.push(`[DRIFT] Go method "${go.name}()" maps to TS method "${mapping.tsName}()" but not found`);
      }
    }
  }

  // TypeScript → Go: every TS method should be accounted for
  for (const ts of tsMethods) {
    if (TS_ONLY.has(ts.name)) continue;
    if (ts.name === "invoke") continue; // TS runner handles invoke(), not Go Provider

    // Look up the reverse mapping
    const reverseEntry = Object.entries(GO_TO_TS_MAP).find(([, v]) => v.tsName === ts.name);
    if (!reverseEntry) {
      errors.push(`[DRIFT] TypeScript method "${ts.name}()" has no Go Provider counterpart in GO_TO_TS_MAP`);
    }
  }

  return errors;
}

// ── Main ───────────────────────────────────────────────────────────────────

const root = path.resolve(__dirname, "..");
const goFile = path.join(root, "internal", "provider", "interface.go");
const tsFile = path.join(root, "packages", "wrapper", "src", "providers", "interface.ts");

if (!fs.existsSync(goFile)) {
  console.error(`verify-contract: not found: ${goFile}`);
  process.exit(1);
}
if (!fs.existsSync(tsFile)) {
  console.error(`verify-contract: not found: ${tsFile}`);
  process.exit(1);
}

const goContent = fs.readFileSync(goFile, "utf8");
const tsContent = fs.readFileSync(tsFile, "utf8");

const goMethods = parseGoInterface(goContent);
const tsMethods = parseTypeScriptInterface(tsContent);

console.log("=== Go Provider interface ===");
for (const m of goMethods) {
  const ret = m.returns.length ? ` → ${m.returns.join(", ")}` : "";
  console.log(`  ${m.name}(${m.params.join(", ")})${ret}`);
}

console.log("\n=== TypeScript IProvider interface ===");
for (const m of tsMethods) {
  const ret = m.returns.length ? `: ${m.returns.join(", ")}` : "";
  console.log(`  ${m.name}(${m.params.join(", ")})${ret}`);
}

const errors = checkDrift(goMethods, tsMethods);

if (errors.length > 0) {
  console.error("\n=== CONTRACT DRIFT DETECTED ===");
  for (const e of errors) {
    console.error(`  ${e}`);
  }
  process.exit(1);
} else {
  console.log("\n✓ Contract is consistent — no drift detected");
  process.exit(0);
}
