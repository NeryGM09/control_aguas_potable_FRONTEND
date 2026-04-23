#!/usr/bin/env node

/**
 * Script de validación previa a Docker
 * Ejecutar con: node scripts/validate-docker.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const checks = [];

function log(symbol, message, details = '') {
  const symbols = { '✅': '\x1b[32m✅\x1b[0m', '❌': '\x1b[31m❌\x1b[0m', '⚠️': '\x1b[33m⚠️\x1b[0m' };
  console.log(`${symbols[symbol]} ${message}`);
  if (details) console.log(`   ${details}`);
}

function check(name, fn) {
  try {
    const result = fn();
    checks.push({ name, passed: result.passed, message: result.message });
    return result.passed;
  } catch (e) {
    checks.push({ name, passed: false, message: String(e) });
    return false;
  }
}

console.log('\n🔍 Validando configuración para Docker...\n');

// 1. Archivos necesarios
check('package.json existe', () => ({
  passed: fs.existsSync(path.join(projectRoot, 'package.json')),
  message: 'package.json encontrado'
}));

check('package-lock.json existe', () => ({
  passed: fs.existsSync(path.join(projectRoot, 'package-lock.json')),
  message: 'package-lock.json encontrado (npm ci funcionará)'
}));

check('Dockerfile existe', () => ({
  passed: fs.existsSync(path.join(projectRoot, 'Dockerfile')),
  message: 'Dockerfile encontrado'
}));

check('docker-compose.yml existe', () => ({
  passed: fs.existsSync(path.join(projectRoot, 'docker-compose.yml')),
  message: 'docker-compose.yml encontrado'
}));

check('nginx.conf existe', () => ({
  passed: fs.existsSync(path.join(projectRoot, 'nginx.conf')),
  message: 'nginx.conf encontrado'
}));

check('.dockerignore existe', () => ({
  passed: fs.existsSync(path.join(projectRoot, '.dockerignore')),
  message: '.dockerignore encontrado'
}));

// 2. Validar contenido de archivos críticos
check('Dockerfile usa node:20-alpine', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'Dockerfile'), 'utf8');
  return {
    passed: content.includes('node:20-alpine'),
    message: 'Imagen base correcta'
  };
});

check('Dockerfile uses npm ci', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'Dockerfile'), 'utf8');
  return {
    passed: content.includes('npm ci'),
    message: 'npm ci encontrado (correcto para Docker)'
  };
});

check('docker-compose.yml tiene servicio backend', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'docker-compose.yml'), 'utf8');
  return {
    passed: content.includes('backend:'),
    message: 'Servicio backend configurado'
  };
});

check('nginx.conf usa "backend" en proxy_pass', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'nginx.conf'), 'utf8');
  return {
    passed: content.includes('http://backend:8000') && !content.includes('api-catv'),
    message: 'Proxy configurado correctamente'
  };
});

check('package.json tiene script "build"', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  return {
    passed: pkg.scripts && pkg.scripts.build === 'vite build',
    message: 'Script build existe y es correcto'
  };
});

// 3. Validaciones de desarrollo
check('node_modules no existe (mejor para Docker)', () => ({
  passed: !fs.existsSync(path.join(projectRoot, 'node_modules')),
  message: 'node_modules no encontrado (bien para Docker clean)'
}));

check('dist no existe (se generará en build)', () => ({
  passed: !fs.existsSync(path.join(projectRoot, 'dist')),
  message: 'dist no encontrado (se creará en build)'
}));

// 4. Resumen
console.log('\n' + '─'.repeat(50));
const passed = checks.filter(c => c.passed).length;
const total = checks.length;

checks.forEach(c => {
  const symbol = c.passed ? '✅' : '❌';
  log(symbol, `${c.name}: ${c.message}`);
});

console.log('\n' + '─'.repeat(50));
console.log(`\n📊 Resultado: ${passed}/${total} validaciones pasadas\n`);

if (passed === total) {
  log('✅', '¡Todo está listo para Docker!');
  console.log('\n🚀 Próximo paso:\n   docker-compose up --build\n');
  process.exit(0);
} else {
  log('❌', `${total - passed} validaciones fallaron`);
  console.log('\nPor favor, revisa DOCKER_DIAGNOSTICO.md para más detalles\n');
  process.exit(1);
}
