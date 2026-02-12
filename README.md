# Rage Web Analytics Dashboard 📊

Sistema de generación de reportes PDF con métricas clave para el negocio de Rage Web.

## 🎯 Funcionalidades

### Reportes Incluidos

1. **Métricas de Retención**
   - Tasa de retención (30 días)
   - Tasa de conversión
   - Usuarios activos vs totales
   - Créditos pendientes de usar

2. **Ventas de Paquetes**
   - Ventas por mes (2026)
   - Ventas por tipo de paquete
   - Ingresos totales

3. **Top Clientas VIP**
   - Top 5 compradoras del año
   - Total gastado por cliente
   - Paquete favorito
   - Datos de contacto

4. **Clientas Inactivas (Reactivación)**
   - Segmentación por días sin actividad (30/60/90)
   - Lista de contacto con teléfonos
   - Estrategias de reactivación

5. **Recomendaciones**
   - Acciones prioritarias
   - Campañas sugeridas

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Verificar conexión con Supabase
npm run test-connection
```

## 📋 Uso

```bash
# Generar reporte PDF
npm run generate
```

El reporte se guardará en la carpeta `reports/` con el nombre:
`rage_dashboard_YYYY-MM-DD_HHmm.pdf`

## ⚙️ Configuración

Asegúrate de tener el archivo `.env` con las credenciales de Supabase:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
# Para operaciones admin:
# SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## 📁 Estructura del Proyecto

```
rage-analytics-dashboard/
├── src/
│   ├── config/
│   │   └── supabase.js       # Cliente de Supabase
│   ├── queries/
│   │   └── analytics.js      # Consultas analíticas
│   ├── generators/
│   │   └── pdf-generator.js  # Generador de PDF
│   ├── generate-dashboard.js # Script principal
│   └── test-connection.js    # Test de conexión
├── reports/                  # PDFs generados
├── .env                      # Configuración
└── package.json
```

## 📊 Queries Disponibles

```javascript
import analytics from './src/queries/analytics.js';

// Clientas dormidas (para campañas de reactivación)
const dormant = await analytics.getDormantClients(30); // días

// Ventas por mes y tipo
const sales = await analytics.getPackageSalesByMonth(2026);

// Top compradoras
const topBuyers = await analytics.getTopBuyers(2026, 5);

// Métricas de retención
const retention = await analytics.getRetentionMetrics();

// Clases populares
const classes = await analytics.getPopularClasses();
```

## 🎨 Personalización

El PDF usa una paleta de colores predefinida en `pdf-generator.js`:

```javascript
const COLORS = {
  primary: '#1100ffff',    // Indigo
  secondary: '#cac9ceff',  // Purple
  success: '#10B981',    // Emerald
  warning: '#F59E0B',    // Amber
  danger: '#EF4444',     // Red
};
```

## 📅 Automatización

Para generar reportes automáticamente cada mes, puedes configurar un cron job:

```bash
# Ejemplo: Generar el día 1 de cada mes a las 8am
0 8 1 * * cd /ruta/al/proyecto && npm run generate
```

---

Desarrollado para **Rage Studios** 🎸
