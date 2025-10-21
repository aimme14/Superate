#!/usr/bin/env node

/**
 * Script para configurar Firebase Storage automáticamente
 * Este script ayuda a configurar las reglas de Storage y CORS
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Configurando Firebase Storage para el banco de preguntas...');

// Crear archivo de reglas de Storage
const storageRules = `rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Permitir acceso a imágenes de preguntas para usuarios autenticados
    match /questions/{allPaths=**} {
      // Leer: cualquier usuario autenticado
      allow read: if request.auth != null;
      
      // Escribir: solo administradores
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Permitir acceso a otros archivos del sistema
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}`;

// Crear archivo de configuración CORS
const corsConfig = [
  {
    "origin": [
      "http://localhost:5173",
      "http://localhost:3000", 
      "http://localhost:8080",
      "https://superate-6c730.web.app",
      "https://superate-6c730.firebaseapp.com"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "maxAgeSeconds": 3600
  }
];

// Crear archivos de configuración
fs.writeFileSync('storage.rules', storageRules);
fs.writeFileSync('cors.json', JSON.stringify(corsConfig, null, 2));

console.log('✅ Archivos de configuración creados:');
console.log('   - storage.rules (reglas de Firebase Storage)');
console.log('   - cors.json (configuración CORS)');

console.log('');
console.log('📋 Pasos para aplicar la configuración:');
console.log('');
console.log('1. 🔥 CONFIGURAR REGLAS DE FIREBASE STORAGE:');
console.log('   a) Ve a Firebase Console: https://console.firebase.google.com/');
console.log('   b) Selecciona tu proyecto "superate-6c730"');
console.log('   c) Ve a Storage → Rules');
console.log('   d) Copia y pega el contenido de storage.rules');
console.log('   e) Haz clic en "Publish"');
console.log('');
console.log('2. 🌐 CONFIGURAR CORS (opcional, si las reglas no funcionan):');
console.log('   a) Instala Google Cloud SDK: https://cloud.google.com/sdk/docs/install');
console.log('   b) Ejecuta: gcloud auth login');
console.log('   c) Ejecuta: gsutil cors set cors.json gs://superate-6c730.firebasestorage.app');
console.log('');
console.log('3. 🧪 PROBAR LA FUNCIONALIDAD:');
console.log('   a) Reinicia tu aplicación');
console.log('   b) Intenta crear una pregunta con imágenes');
console.log('   c) Verifica que no aparezcan errores de CORS en la consola');
console.log('');
console.log('💡 NOTA: Si Firebase Storage no funciona, el sistema usará Base64 como fallback');
console.log('   Esto permite que las imágenes se almacenen directamente en Firestore.');
console.log('');
console.log('🎉 ¡Configuración completada! Los archivos están listos para usar.');

// Crear un archivo de instrucciones
const instructions = `# 🔧 Configuración de Firebase Storage

## Archivos creados:
- storage.rules: Reglas de seguridad para Firebase Storage
- cors.json: Configuración CORS para permitir subidas desde localhost

## Pasos para aplicar:

### 1. Reglas de Firebase Storage
1. Ve a Firebase Console: https://console.firebase.google.com/
2. Selecciona tu proyecto "superate-6c730"
3. Ve a Storage → Rules
4. Copia y pega el contenido de storage.rules
5. Haz clic en "Publish"

### 2. Configuración CORS (si es necesario)
1. Instala Google Cloud SDK
2. Ejecuta: gcloud auth login
3. Ejecuta: gsutil cors set cors.json gs://superate-6c730.firebasestorage.app

### 3. Probar
1. Reinicia tu aplicación
2. Crea una pregunta con imágenes
3. Verifica que no hay errores de CORS

## Fallback
Si Firebase Storage no funciona, el sistema usará Base64 automáticamente.
`;

fs.writeFileSync('INSTRUCCIONES_STORAGE.md', instructions);

console.log('📄 Archivo de instrucciones creado: INSTRUCCIONES_STORAGE.md');
