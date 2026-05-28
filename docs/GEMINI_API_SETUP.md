# Configuración de Gemini 3.0 Pro API

Esta guía te ayudará a configurar y pagar por la API de Google Gemini 3.0 Pro para habilitar las funciones de inteligencia artificial en la aplicación.

## 📋 Tabla de Contenidos

1. [Obtener la API Key](#obtener-la-api-key)
2. [Configurar la Facturación](#configurar-la-facturación)
3. [Precios y Costos](#precios-y-costos)
4. [Configurar en el Proyecto](#configurar-en-el-proyecto)
5. [Verificar la Configuración](#verificar-la-configuración)
6. [Uso y Límites](#uso-y-límites)

---

## 🔑 Obtener la API Key

### Paso 1: Acceder a Google AI Studio

1. Ve a [Google AI Studio](https://aistudio.google.com/)
2. Inicia sesión con tu cuenta de Google
3. Si es tu primera vez, acepta los términos y condiciones

### Paso 2: Crear una API Key

1. En el menú lateral, haz clic en **"Get API key"** o **"Obtener clave de API"**
2. Selecciona **"Create API key"** o **"Crear clave de API"**
3. Elige una de estas opciones:
   - **Crear clave en un proyecto nuevo** (recomendado para empezar)
   - **Crear clave en un proyecto existente** (si ya tienes un proyecto de Google Cloud)
4. Copia la API key que se genera (la necesitarás más adelante)

⚠️ **Importante**: Guarda la API key en un lugar seguro. No la compartas públicamente.

---

## 💳 Configurar la Facturación

> ⚠️ **IMPORTANTE**: Puedes empezar a usar Gemini **SIN configurar facturación** inicialmente. Solo necesitas obtener la API key de Google AI Studio. La facturación solo es necesaria si quieres superar los límites gratuitos o usar modelos más avanzados.

### ¿Necesito facturación para empezar?

**NO necesitas facturación para empezar**. Puedes:
1. Obtener tu API key en [Google AI Studio](https://aistudio.google.com/) (sin facturación)
2. Usar el nivel gratuito con límites generosos
3. Configurar facturación más tarde si lo necesitas

**SÍ necesitas facturación si:**
- Quieres superar los límites gratuitos (1,500 solicitudes/día)
- Necesitas acceso a modelos más avanzados
- Requieres mayor capacidad de procesamiento

---

Para usar Gemini 3.0 Pro con todas sus capacidades, necesitas habilitar la facturación.

### Paso 1: Habilitar Facturación en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (o crea uno nuevo)
3. En el menú lateral, ve a **"Billing"** o **"Facturación"**
4. Haz clic en **"Link a billing account"** o **"Vincular cuenta de facturación"**
5. Sigue las instrucciones para:
   - Agregar un método de pago (tarjeta de crédito/débito)
   - Completar la información fiscal
   - Aceptar los términos de servicio

### Paso 2: Habilitar la API de Gemini

1. En Google Cloud Console, ve a **"APIs & Services"** > **"Library"**
2. Busca **"Generative Language API"** o **"Vertex AI API"**
3. Haz clic en **"Enable"** o **"Habilitar"**

### Paso 3: Configurar y Modificar Límites de Facturación (Opcional pero Recomendado)

Para evitar sorpresas en la factura, puedes configurar presupuestos y límites de facturación. Esto te permite controlar cuánto gastas y recibir alertas cuando te acerques a tus límites.

#### Crear un Presupuesto (Budget)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. En el menú lateral, ve a **"Billing"** > **"Budgets & alerts"**
4. Haz clic en **"CREATE BUDGET"** o **"CREAR PRESUPUESTO"**
5. Configura el presupuesto:
   - **Nombre del presupuesto**: Ej. "Presupuesto Gemini API"
   - **Período**: Selecciona "Monthly" (Mensual) o "Custom" (Personalizado)
   - **Monto**: Establece el límite mensual (ej. $10, $50, $100 USD)
   - **Alcance**: Selecciona tu cuenta de facturación
6. Haz clic en **"NEXT"** o **"SIGUIENTE"**

#### Configurar Alertas de Presupuesto

1. En la sección **"Set alert threshold"** o **"Establecer umbral de alerta"**:
   - Agrega alertas en porcentajes: **50%**, **75%**, **90%**, **100%**
   - O agrega alertas en montos específicos (ej. $5, $10, $20)
2. Configura las notificaciones:
   - **Email**: Ingresa tu correo electrónico
   - **SMS** (opcional): Ingresa tu número de teléfono
   - Puedes agregar múltiples destinatarios
3. Haz clic en **"CREATE"** o **"CREAR"**

#### Modificar un Presupuesto Existente

1. Ve a **"Billing"** > **"Budgets & alerts"**
2. Encuentra el presupuesto que quieres modificar
3. Haz clic en el nombre del presupuesto o en el ícono de **"Edit"** (lápiz)
4. Modifica los valores que necesites:
   - **Monto del presupuesto**: Cambia el límite mensual
   - **Alertas**: Agrega, modifica o elimina alertas
   - **Notificaciones**: Actualiza los correos o números de teléfono
5. Haz clic en **"SAVE"** o **"GUARDAR"**

#### Configurar Límite de Facturación (Billing Limit)

⚠️ **Importante**: Los límites de facturación pueden detener todos los servicios cuando se alcanzan. Úsalos con precaución.

1. Ve a **"Billing"** > **"Account management"** o **"Administración de cuentas"**
2. Selecciona tu cuenta de facturación
3. Haz clic en **"EDIT"** o **"EDITAR"** junto a "Billing account settings"
4. En la sección **"Billing limit"** o **"Límite de facturación"**:
   - Activa el toggle **"Set a billing limit"** o **"Establecer un límite de facturación"**
   - Ingresa el monto máximo que quieres gastar (ej. $50, $100, $200)
5. Haz clic en **"SAVE"** o **"GUARDAR"**

**Nota**: Cuando se alcanza el límite de facturación, **todos los servicios se detienen automáticamente** hasta que aumentes el límite o se reinicie el período de facturación.

#### Modificar el Límite de Facturación

1. Ve a **"Billing"** > **"Account management"**
2. Selecciona tu cuenta de facturación
3. Haz clic en **"EDIT"** junto a "Billing account settings"
4. Modifica el monto en **"Billing limit"**
5. Haz clic en **"SAVE"**

#### Eliminar o Desactivar un Presupuesto

1. Ve a **"Billing"** > **"Budgets & alerts"**
2. Encuentra el presupuesto que quieres eliminar
3. Haz clic en el menú de tres puntos (**⋮**) junto al presupuesto
4. Selecciona **"Delete budget"** o **"Eliminar presupuesto"**
5. Confirma la eliminación

#### Eliminar o Desactivar el Límite de Facturación

1. Ve a **"Billing"** > **"Account management"**
2. Selecciona tu cuenta de facturación
3. Haz clic en **"EDIT"** junto a "Billing account settings"
4. Desactiva el toggle **"Set a billing limit"**
5. Haz clic en **"SAVE"**

#### Recomendaciones de Configuración

Para una aplicación educativa con uso moderado:

- **Presupuesto mensual**: $10 - $50 USD (ajusta según tu uso esperado)
- **Alertas**: Configura en 50%, 75%, 90% y 100%
- **Límite de facturación**: Opcional, pero si lo usas, ponlo 10-20% más alto que tu presupuesto para evitar interrupciones
- **Notificaciones**: Usa tu correo principal y considera agregar un correo secundario

#### Monitorear el Uso en Tiempo Real

1. Ve a **"Billing"** > **"Reports"** o **"Informes"**
2. Selecciona el período que quieres ver (día, semana, mes)
3. Filtra por servicio: **"Generative Language API"** o **"Vertex AI API"**
4. Revisa los gráficos de uso y costos

---

## 💰 Precios y Costos

### Modelo: Gemini 2.0 Flash (Experimental) - Equivalente a Gemini 3.0 Pro

**Precios actuales (a partir de 2024):**

#### Entrada (Input):
- **Hasta 128K tokens**: $0.00 por millón de tokens (GRATIS durante el período de prueba)
- **128K-1M tokens**: $0.075 por millón de tokens
- **Más de 1M tokens**: $0.30 por millón de tokens

#### Salida (Output):
- **Hasta 128K tokens**: $0.00 por millón de tokens (GRATIS durante el período de prueba)
- **128K-1M tokens**: $0.30 por millón de tokens
- **Más de 1M tokens**: $1.20 por millón de tokens

### Ejemplo de Costos Estimados

Para nuestra aplicación educativa:

- **Análisis de un estudiante**: ~2,000 tokens entrada + ~1,500 tokens salida
  - Costo: ~$0.0006 por análisis (muy económico)
- **100 análisis al mes**: ~$0.06 USD
- **1,000 análisis al mes**: ~$0.60 USD
- **10,000 análisis al mes**: ~$6.00 USD

### Período de Prueba Gratuita

Google ofrece un **período de prueba gratuito** con:
- **$300 USD en créditos** para usar durante 90 días
- **60 solicitudes por minuto** (RPM) gratis
- **1,500 solicitudes por día** (RPD) gratis

Esto es más que suficiente para probar y desarrollar la aplicación.

---

## ⚙️ Configurar en el Proyecto

### Paso 1: Crear archivo .env

En la raíz del proyecto, crea o edita el archivo `.env`:

```env
# Gemini AI Configuration
VITE_GEMINI_API_KEY=tu_api_key_aqui
```

### Paso 2: Agregar a .gitignore

Asegúrate de que `.env` esté en tu `.gitignore` para no subir la API key al repositorio:

```gitignore
# Environment variables
.env
.env.local
.env.production
```

### Paso 3: Configurar en Producción

Si estás usando Vercel, Netlify u otro servicio:

1. Ve a la configuración del proyecto
2. Agrega la variable de entorno:
   - **Nombre**: `VITE_GEMINI_API_KEY`
   - **Valor**: Tu API key de Gemini
3. Guarda y redespliega la aplicación

---

## ✅ Verificar la Configuración

### Verificar que la API Key funciona

1. Inicia la aplicación en modo desarrollo:
   ```bash
   npm run dev
   ```

2. Abre la consola del navegador (F12)
3. Deberías ver el mensaje: `✅ Servicio de Gemini AI inicializado correctamente`

4. Si ves un error, verifica:
   - Que la API key esté correctamente configurada en `.env`
   - Que la variable de entorno comience con `VITE_`
   - Que hayas reiniciado el servidor de desarrollo después de agregar la variable

### Probar la Funcionalidad

1. Ve a la página de análisis (`/promedio`)
2. Si tienes evaluaciones completadas, deberías ver:
   - Un indicador de "Generando recomendaciones con IA..."
   - Recomendaciones personalizadas con el badge "IA"
   - Explicaciones detalladas generadas por Gemini

---

## 📊 Uso y Límites

### Límites de Cuota

**Nivel Gratuito (Free Tier):**
- 60 solicitudes por minuto (RPM)
- 1,500 solicitudes por día (RPD)
- 32,000 tokens por minuto (TPM)

**Nivel de Pago:**
- Límites más altos según tu plan
- Puedes solicitar aumentos de cuota en Google Cloud Console

### Monitoreo de Uso

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Navega a **"APIs & Services"** > **"Dashboard"**
3. Selecciona **"Generative Language API"**
4. Verás métricas de uso en tiempo real

### Optimización de Costos

Para reducir costos:

1. **Cachear resultados**: Guarda análisis similares en Firebase
2. **Limitar frecuencia**: No regenerar análisis si los datos no han cambiado
3. **Usar modelos más económicos**: Para tareas simples, considera usar `gemini-1.5-flash`
4. **Configurar límites**: Usa los límites de facturación mencionados arriba

---

## 🆘 Solución de Problemas

### Error: "[OR-CBAT-23]" al configurar facturación

Este error aparece cuando intentas agregar un método de pago en Google Cloud. Aquí están las soluciones:

#### Solución 1: Verificar la tarjeta
1. **Verifica que tu tarjeta esté activa** y tenga fondos suficientes
2. **Confirma que la tarjeta acepte pagos internacionales** (Google Cloud es un servicio internacional)
3. **Verifica que no esté bloqueada** por tu banco para transacciones online

#### Solución 2: Limpiar caché y cookies
1. Cierra completamente el navegador
2. Limpia la caché y cookies de Google Cloud Console
3. Vuelve a intentar el proceso

#### Solución 3: Usar otro navegador
1. Prueba con un navegador diferente (Chrome, Firefox, Edge)
2. Asegúrate de estar en modo incógnito/privado
3. Intenta nuevamente

#### Solución 4: Verificar información de facturación
1. Asegúrate de que la **dirección de facturación** coincida exactamente con la de tu tarjeta
2. Verifica que el **código postal** sea correcto
3. Confirma que el **país** sea el correcto

#### Solución 5: Contactar al banco
1. Algunos bancos bloquean automáticamente transacciones de Google Cloud
2. Llama a tu banco y solicita que **autoricen transacciones de Google Cloud Platform**
3. Menciona que es para servicios de Google Cloud (no es una compra sospechosa)

#### Solución 6: Usar otra tarjeta
1. Intenta con una **tarjeta de crédito diferente**
2. O usa una **tarjeta de débito** que permita pagos internacionales
3. Algunos bancos tienen políticas más estrictas que otros

#### Solución 7: Esperar y reintentar
1. A veces es un problema temporal del servidor de Google
2. Espera **15-30 minutos** y vuelve a intentar
3. Intenta en un horario diferente (evita horas pico)

#### Solución 8: Verificar cuenta de Google
1. Asegúrate de que tu cuenta de Google esté **verificada completamente**
2. Verifica tu número de teléfono y correo electrónico
3. Asegúrate de no tener restricciones en tu cuenta

#### Solución 9: Crear un nuevo proyecto
1. A veces el problema está en el proyecto específico
2. Crea un **nuevo proyecto** en Google Cloud Console
3. Intenta configurar la facturación en el nuevo proyecto

#### Solución 10: Contactar soporte de Google
Si ninguna de las soluciones anteriores funciona:
1. Ve a [Soporte de Google Cloud](https://cloud.google.com/support)
2. Selecciona "Billing" como categoría
3. Menciona el código de error: **OR-CBAT-23**
4. Proporciona detalles sobre tu problema

### ⚠️ Importante: Puedes usar Gemini SIN facturación inicialmente

**Buenas noticias**: Puedes obtener una API key y empezar a usar Gemini **SIN configurar facturación** inicialmente:

1. Ve a [Google AI Studio](https://aistudio.google.com/)
2. Crea una API key directamente (no requiere facturación)
3. Tendrás acceso gratuito con límites:
   - 60 solicitudes por minuto
   - 1,500 solicitudes por día
   - Esto es suficiente para desarrollo y pruebas

La facturación solo es necesaria cuando:
- Quieras usar más de los límites gratuitos
- Necesites acceso a modelos más avanzados
- Requieras mayor capacidad de procesamiento

### Error: "API key not valid"
- Verifica que la API key esté correctamente copiada
- Asegúrate de que no tenga espacios al inicio o final
- Verifica que la API esté habilitada en Google Cloud Console

### Error: "Quota exceeded"
- Has alcanzado el límite de solicitudes
- Espera unos minutos o aumenta tu cuota en Google Cloud Console

### Error: "Billing not enabled"
- Necesitas habilitar la facturación para usar el modelo completo
- Sigue los pasos en la sección "Configurar la Facturación"
- **O usa el nivel gratuito** que no requiere facturación

### La IA no genera recomendaciones
- Verifica que `VITE_GEMINI_API_KEY` esté configurada
- Revisa la consola del navegador para ver errores
- Asegúrate de tener datos de evaluaciones para analizar

---

## 📚 Recursos Adicionales

- [Documentación oficial de Gemini API](https://ai.google.dev/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Precios actualizados de Gemini](https://ai.google.dev/pricing)

---

## 🔒 Seguridad

**IMPORTANTE**: 

- ⚠️ **NUNCA** subas tu API key a repositorios públicos
- ⚠️ **NUNCA** compartas tu API key en código que se muestre al cliente
- ✅ Usa variables de entorno para almacenar la API key
- ✅ Configura límites de facturación para evitar costos inesperados
- ✅ Revisa regularmente el uso en Google Cloud Console

---

## 📞 Soporte

Si tienes problemas:

1. Revisa la [documentación oficial de Google](https://ai.google.dev/docs)
2. Consulta el [foro de Google AI](https://developers.googleblog.com/2023/12/how-its-made-gemini-multimodal-prompting.html)
3. Contacta al soporte de Google Cloud si es un problema de facturación

---

**Última actualización**: Diciembre 2024

