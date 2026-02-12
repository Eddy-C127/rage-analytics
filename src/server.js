/**
 * Rage Analytics - Web Server
 * Servidor Express para la interfaz gráfica del dashboard
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import analytics from './queries/analytics.js';
import DashboardPDFGenerator from './generators/pdf-generator.js';
import fs from 'fs';
import dayjs from 'dayjs';
import 'dayjs/locale/es.js';

dayjs.locale('es');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Variable para cachear perfiles
let profilesLoaded = false;

// Cargar perfiles al inicio
async function ensureProfiles() {
    if (!profilesLoaded) {
        await analytics.loadProfiles();
        profilesLoaded = true;
    }
}

// ===================== API ENDPOINTS =====================

/**
 * GET /api/health - Health check
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/analytics/retention - Métricas de retención
 */
app.post('/api/analytics/retention', async (req, res) => {
    try {
        await ensureProfiles();
        const data = await analytics.getRetentionMetrics();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/sales - Ventas por período
 */
app.post('/api/analytics/sales', async (req, res) => {
    try {
        await ensureProfiles();
        const { year = 2026, startDate, endDate } = req.body;

        // Si hay fechas específicas, usar esas
        let data;
        if (startDate && endDate) {
            data = await analytics.getPackageSalesByDateRange(startDate, endDate);
        } else {
            data = await analytics.getPackageSalesByMonth(year);
        }

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/top-buyers - Top compradoras
 */
app.post('/api/analytics/top-buyers', async (req, res) => {
    try {
        await ensureProfiles();
        const { year = 2026, limit = 10, startDate, endDate } = req.body;

        let data;
        if (startDate && endDate) {
            data = await analytics.getTopBuyersByDateRange(startDate, endDate, limit);
        } else {
            data = await analytics.getTopBuyers(year, limit);
        }

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/dormant - Clientas inactivas
 */
app.post('/api/analytics/dormant', async (req, res) => {
    try {
        await ensureProfiles();
        const { daysInactive = 30 } = req.body;
        const data = await analytics.getDormantClients(daysInactive);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/popular-classes - Clases populares
 */
app.post('/api/analytics/popular-classes', async (req, res) => {
    try {
        await ensureProfiles();
        const data = await analytics.getPopularClasses();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/attendance - Estadísticas de asistencia
 */
app.post('/api/analytics/attendance', async (req, res) => {
    try {
        await ensureProfiles();
        const data = await analytics.getAttendanceStats();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/compare - Comparativa de períodos
 */
app.post('/api/analytics/compare', async (req, res) => {
    try {
        await ensureProfiles();
        const { period1Start, period1End, period2Start, period2End } = req.body;

        const [sales1, sales2] = await Promise.all([
            analytics.getPackageSalesByDateRange(period1Start, period1End),
            analytics.getPackageSalesByDateRange(period2Start, period2End)
        ]);

        const comparison = {
            period1: {
                range: `${dayjs(period1Start).format('DD/MM/YYYY')} - ${dayjs(period1End).format('DD/MM/YYYY')}`,
                ...sales1
            },
            period2: {
                range: `${dayjs(period2Start).format('DD/MM/YYYY')} - ${dayjs(period2End).format('DD/MM/YYYY')}`,
                ...sales2
            },
            diff: {
                packages: sales2.total_packages - sales1.total_packages,
                packages_pct: sales1.total_packages > 0 ?
                    (((sales2.total_packages - sales1.total_packages) / sales1.total_packages) * 100).toFixed(1) : 0,
                revenue: sales2.total_revenue - sales1.total_revenue,
                revenue_pct: sales1.total_revenue > 0 ?
                    (((sales2.total_revenue - sales1.total_revenue) / sales1.total_revenue) * 100).toFixed(1) : 0
            }
        };

        res.json({ success: true, data: comparison });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/generate-pdf - Generar reporte PDF
 */
app.post('/api/generate-pdf', async (req, res) => {
    try {
        await ensureProfiles();
        const { year = 2026, startDate, endDate } = req.body;

        console.log('📄 Generando PDF...');

        // Obtener todos los datos
        const [retention, sales, topBuyers, popularClasses, attendance, dormant30, dormant60, dormant90, weeklySchedule] =
            await Promise.all([
                analytics.getRetentionMetrics(),
                startDate && endDate ?
                    analytics.getPackageSalesByDateRange(startDate, endDate) :
                    analytics.getPackageSalesByMonth(year),
                startDate && endDate ?
                    analytics.getTopBuyersByDateRange(startDate, endDate, 5) :
                    analytics.getTopBuyers(year, 5),
                analytics.getPopularClasses(),
                analytics.getAttendanceStats(),
                analytics.getDormantClients(30),
                analytics.getDormantClients(60),
                analytics.getDormantClients(90),
                analytics.getWeeklySchedule()
            ]);

        const dashboardData = {
            generated_at: new Date().toISOString(),
            period: startDate && endDate ?
                `${dayjs(startDate).format('DD/MM/YYYY')} - ${dayjs(endDate).format('DD/MM/YYYY')}` :
                `Año ${year}`,
            retention,
            sales,
            top_buyers: topBuyers,
            popular_classes: popularClasses.slice(0, 5),
            attendance,
            weekly_schedule: weeklySchedule,
            dormant_clients: {
                '30_days': dormant30.total,
                '60_days': dormant60.total,
                '90_days': dormant90.total,
                clients_30_days: dormant30.clients.slice(0, 10)
            }
        };

        const pdfGenerator = new DashboardPDFGenerator('./reports');
        const pdfPath = await pdfGenerator.generateFullReport(dashboardData);
        const filename = path.basename(pdfPath);

        console.log(`✅ PDF generado: ${filename}`);

        res.json({
            success: true,
            filename,
            downloadUrl: `/reports/${filename}`,
            data: dashboardData
        });
    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/reports - Listar reportes generados
 */
app.get('/api/reports', (req, res) => {
    try {
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            return res.json({ success: true, reports: [] });
        }

        const files = fs.readdirSync(reportsDir)
            .filter(f => f.endsWith('.pdf'))
            .map(f => ({
                filename: f,
                downloadUrl: `/reports/${f}`,
                createdAt: fs.statSync(path.join(reportsDir, f)).mtime
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, reports: files });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/weekly-schedule - Horario semanal con ocupación
 */
app.post('/api/analytics/weekly-schedule', async (req, res) => {
    try {
        await ensureProfiles();
        const data = await analytics.getWeeklySchedule();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/user-history - Historial de compras de usuario
 */
app.post('/api/analytics/user-history', async (req, res) => {
    try {
        await ensureProfiles();
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        const data = await analytics.getUserPurchaseHistory(userId);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/dormant-paginated - Clientas inactivas con paginación
 */
app.post('/api/analytics/dormant-paginated', async (req, res) => {
    try {
        await ensureProfiles();
        const { daysInactive = 30, page = 1, pageSize = 20 } = req.body;
        const data = await analytics.getDormantClientsPaginated(daysInactive, page, pageSize);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analytics/credits-compare - Comparativa de créditos
 */
app.post('/api/analytics/credits-compare', async (req, res) => {
    try {
        await ensureProfiles();
        const { period1Start, period1End, period2Start, period2End } = req.body;
        const data = await analytics.getCreditsComparison(period1Start, period1End, period2Start, period2End);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Servir index.html para todas las rutas no-API (Express 5 compatible)
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Iniciar servidor (solo en entorno local, no en Vercel)
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║         RAGE ANALYTICS - DASHBOARD WEB                   ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
        console.log('');
        console.log('📊 Endpoints disponibles:');
        console.log('   POST /api/analytics/retention');
        console.log('   POST /api/analytics/sales');
        console.log('   POST /api/analytics/top-buyers');
        console.log('   POST /api/analytics/dormant');
        console.log('   POST /api/analytics/compare');
        console.log('   POST /api/generate-pdf');
        console.log('   GET  /api/reports');
        console.log('');
    });
}

export default app;
