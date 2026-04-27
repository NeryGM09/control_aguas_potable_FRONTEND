#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const checks = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function addCheck(name, passed, message) {
  checks.push({ name, passed, message });
}

function runCheck(name, fn) {
  try {
    const result = fn();
    addCheck(name, result.passed, result.message);
  } catch (error) {
    addCheck(name, false, String(error));
  }
}

function printLine(symbol, message) {
  const color =
    symbol === "OK" ? "\x1b[32m" : symbol === "FAIL" ? "\x1b[31m" : "\x1b[33m";
  const label = symbol === "OK" ? "[OK]" : symbol === "FAIL" ? "[FAIL]" : "[WARN]";
  console.log(`${color}${label}\x1b[0m ${message}`);
}

console.log("\nValidando configuracion Docker del proyecto...\n");

runCheck("Archivos base", () => {
  const required = [
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "docker-compose.yml",
    "nginx.conf",
    ".dockerignore",
    ".env.example",
  ];
  const missing = required.filter((item) => !exists(item));
  return missing.length === 0
    ? { passed: true, message: "Archivos base presentes." }
    : { passed: false, message: `Faltan: ${missing.join(", ")}` };
});

runCheck("Scripts npm", () => {
  const pkg = JSON.parse(readText("package.json"));
  const scripts = pkg.scripts || {};
  const requiredScripts = {
    build: "vite build",
    "docker:validate": "node scripts/validate-docker.js",
    "android:build": "npm run build && npx cap sync android",
    "android:apk":
      "powershell -ExecutionPolicy Bypass -File .\\\\scripts\\\\build-apk.ps1 -Variant release",
  };
  const missing = Object.entries(requiredScripts)
    .filter(([name, value]) => scripts[name] !== value)
    .map(([name]) => name);
  return missing.length === 0
    ? { passed: true, message: "Scripts principales correctos." }
    : { passed: false, message: `Scripts faltantes o distintos: ${missing.join(", ")}` };
});

runCheck("Dockerfile", () => {
  const content = readText("Dockerfile");
  const requiredSnippets = [
    "FROM node:20-alpine AS build",
    "RUN npm ci",
    "ARG VITE_API_BASE_URL=/",
    "FROM nginx:1.27-alpine",
  ];
  const missing = requiredSnippets.filter((item) => !content.includes(item));
  return missing.length === 0
    ? { passed: true, message: "Base image, build y defaults correctos." }
    : { passed: false, message: `Faltan fragmentos: ${missing.join(" | ")}` };
});

runCheck("docker-compose.yml", () => {
  const content = readText("docker-compose.yml");
  const requiredSnippets = [
    "frontend_agua:",
    "api-catv:",
    "VITE_API_BASE_URL: ${VITE_API_BASE_URL:-/}",
    "context: ${API_CATV_ROOT:-../API_CATV}",
    "${API_CATV_ENV_FILE:-../API_CATV/backend/.env}",
  ];
  const missing = requiredSnippets.filter((item) => !content.includes(item));
  return missing.length === 0
    ? { passed: true, message: "Servicios y variables portables configurados." }
    : { passed: false, message: `Faltan fragmentos: ${missing.join(" | ")}` };
});

runCheck("nginx.conf", () => {
  const content = readText("nginx.conf");
  const passed =
    content.includes("location /api/") &&
    content.includes("proxy_pass http://api-catv:8000/api/;") &&
    content.includes("try_files $uri $uri/ /index.html;");
  return passed
    ? { passed: true, message: "Proxy API y fallback SPA correctos." }
    : { passed: false, message: "Nginx no coincide con la configuracion esperada." };
});

runCheck(".env.example", () => {
  const content = readText(".env.example");
  const requiredVars = [
    "VITE_API_BASE_URL=/",
    "VITE_API_BASE_URL_NATIVE=",
    "VITE_API_TIMEOUT=30000",
    "VITE_LOGO_TRESVALLES_URL=",
    "VITE_LOGO_CHUMBAGUA_URL=",
    "VITE_LOGO_DEFAULT_URL=",
  ];
  const missing = requiredVars.filter((item) => !content.includes(item));
  return missing.length === 0
    ? { passed: true, message: "Variables de entorno documentadas." }
    : { passed: false, message: `Variables faltantes: ${missing.join(" | ")}` };
});

runCheck(".dockerignore", () => {
  const content = readText(".dockerignore");
  const requiredEntries = ["node_modules", "dist", "android", ".git", "Instalador_apk"];
  const missing = requiredEntries.filter((item) => !content.includes(item));
  return missing.length === 0
    ? { passed: true, message: "Contexto Docker limpio." }
    : { passed: false, message: `Entradas faltantes: ${missing.join(", ")}` };
});

runCheck("APK corporativo", () => {
  const apkDir = path.join(projectRoot, "Instalador_apk");
  if (!fs.existsSync(apkDir)) {
    return { passed: false, message: "La carpeta Instalador_apk no existe." };
  }
  const files = fs
    .readdirSync(apkDir)
    .filter((file) => file.toLowerCase().endsWith(".apk"));
  return files.length > 0
    ? { passed: true, message: `APK(s) encontrado(s): ${files.join(", ")}` }
    : { passed: false, message: "Instalador_apk existe pero no contiene APK." };
});

console.log("-".repeat(60));
for (const item of checks) {
  printLine(item.passed ? "OK" : "FAIL", `${item.name}: ${item.message}`);
}

const passedCount = checks.filter((item) => item.passed).length;
console.log("-".repeat(60));
console.log(`Resultado: ${passedCount}/${checks.length} validaciones correctas.\n`);

if (passedCount === checks.length) {
  printLine("OK", "Configuracion Docker lista para compartirse.");
  console.log("\nSiguiente paso sugerido: docker compose up --build\n");
  process.exit(0);
}

printLine("FAIL", "Hay ajustes pendientes antes de compartir la configuracion Docker.");
process.exit(1);
