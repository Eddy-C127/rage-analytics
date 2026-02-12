/**
 * PDF Generator Module
 * Genera reportes PDF profesionales para Rage Web
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import 'dayjs/locale/es.js';

dayjs.locale('es');

// Colores de marca
const COLORS = {
    primary: '#6366F1',      // Indigo
    secondary: '#8B5CF6',    // Purple
    success: '#10B981',      // Emerald
    warning: '#F59E0B',      // Amber
    danger: '#EF4444',       // Red
    dark: '#1F2937',         // Gray 800
    light: '#F3F4F6',        // Gray 100
    muted: '#6B7280',        // Gray 500
    white: '#FFFFFF'
};

export class DashboardPDFGenerator {
    constructor(outputDir = './reports') {
        this.outputDir = outputDir;
        this.ensureOutputDir();
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Genera el reporte completo del dashboard
     */
    async generateFullReport(data) {
        const filename = `rage_dashboard_${dayjs().format('YYYY-MM-DD_HHmm')}.pdf`;
        const filepath = path.join(this.outputDir, filename);

        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            info: {
                Title: 'Rage Web - Dashboard Analytics',
                Author: 'Rage Studios',
                Subject: 'Reporte mensual de métricas y análisis',
                CreationDate: new Date()
            }
        });

        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Generar páginas
        this.renderCoverPage(doc, data);
        doc.addPage();
        this.renderRetentionPage(doc, data.retention);
        doc.addPage();
        this.renderSalesPage(doc, data.sales);
        doc.addPage();
        this.renderTopBuyersPage(doc, data.top_buyers);
        doc.addPage();
        this.renderWeeklySchedulePage(doc, data.weekly_schedule);
        doc.addPage();
        this.renderAttendancePage(doc, data.attendance, data.popular_classes);
        doc.addPage();
        this.renderDormantClientsPage(doc, data.dormant_clients);
        doc.addPage();
        this.renderRecommendationsPage(doc, data);

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(filepath));
            stream.on('error', reject);
        });
    }

    /**
     * Página de portada
     */
    renderCoverPage(doc, data) {
        // Fondo degradado (simulado con rectángulo)
        doc.rect(0, 0, doc.page.width, doc.page.height)
            .fill(COLORS.dark);

        // Logo / Título principal
        doc.fontSize(48)
            .fillColor(COLORS.white)
            .font('Helvetica-Bold')
            .text('RAGE', 50, 200, { align: 'center' });

        doc.fontSize(24)
            .fillColor(COLORS.primary)
            .text('WEB ANALYTICS', 50, 260, { align: 'center' });

        // Línea decorativa
        doc.moveTo(200, 310)
            .lineTo(412, 310)
            .strokeColor(COLORS.primary)
            .lineWidth(3)
            .stroke();

        // Subtítulo
        doc.fontSize(16)
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .text('Dashboard de Métricas y Análisis', 50, 340, { align: 'center' });

        // Fecha de generación
        doc.fontSize(14)
            .fillColor(COLORS.white)
            .text(dayjs().format('MMMM YYYY').toUpperCase(), 50, 400, { align: 'center' });

        // Métricas destacadas al pie
        const y = 500;
        this.renderMetricBox(doc, 80, y, 'Usuarios', data.retention.total_registered_users, COLORS.primary);
        this.renderMetricBox(doc, 230, y, 'Ventas 2026', data.sales.total_packages, COLORS.success);
        this.renderMetricBox(doc, 380, y, 'Ingresos', `$${this.formatNumber(data.sales.total_revenue)}`, COLORS.secondary);

        // Footer
        doc.fontSize(10)
            .fillColor(COLORS.muted)
            .text(`Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 50, 720, { align: 'center' });
    }

    /**
     * Página de métricas de retención
     */
    renderRetentionPage(doc, retention) {
        this.renderPageHeader(doc, '📊 Métricas de Retención');

        let y = 120;

        // KPIs principales
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Indicadores Clave de Rendimiento (KPIs)', 50, y);

        y += 30;

        const kpis = [
            { label: 'Tasa de Retención (30 días)', value: `${retention.retention_rate}%`, color: COLORS.success },
            { label: 'Tasa de Conversión', value: `${retention.conversion_rate}%`, color: COLORS.primary },
            { label: 'Usuarios Activos (30 días)', value: retention.active_users_30_days, color: COLORS.secondary },
            { label: 'Compradores (30 días)', value: retention.buyers_last_30_days, color: COLORS.warning }
        ];


        const boxWidth = 120;
        const boxHeight = 80;
        const gap = 15;

        kpis.forEach((kpi, i) => {
            const x = 50 + (i * (boxWidth + gap));
            this.renderKPIBox(doc, x, y, boxWidth, boxHeight, kpi.label, kpi.value, kpi.color);
        });

        y += boxHeight + 50;

        // Tabla de detalles
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Detalle de Usuarios', 50, y);

        y += 25;

        const rows = [
            ['Métrica', 'Valor'],
            ['Total usuarios registrados', retention.total_registered_users],
            ['Compradores (histórico)', retention.total_buyers_ever],
            ['Compradores (últimos 30 días)', retention.buyers_last_30_days],
            ['Usuarios con créditos disponibles', retention.users_with_credits],
            ['Créditos pendientes de usar', retention.total_credits_pending]
        ];

        this.renderTable(doc, 50, y, rows, [300, 150]);

        // Insights
        y += (rows.length * 25) + 40;
        this.renderInsightBox(doc, 50, y, 510,
            '💡 Insight',
            `Tu tasa de conversión es ${retention.conversion_rate}%. ` +
            `Esto significa que de cada 100 usuarios registrados, ${Math.round(retention.conversion_rate)} han realizado al menos una compra. ` +
            `${retention.total_credits_pending > 0 ? `Hay ${retention.total_credits_pending} créditos pendientes de usar - considera enviar recordatorios.` : ''}`
        );
    }

    /**
     * Página de ventas
     */
    renderSalesPage(doc, sales) {
        this.renderPageHeader(doc, '💰 Ventas de Paquetes 2026');

        let y = 120;

        // Resumen
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Resumen Anual', 50, y);

        y += 25;

        doc.fontSize(32)
            .fillColor(COLORS.success)
            .font('Helvetica-Bold')
            .text(`$${this.formatNumber(sales.total_revenue)}`, 50, y);

        doc.fontSize(12)
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .text(`${sales.total_packages} paquetes vendidos`, 50, y + 40);

        y += 80;

        // Ventas por mes
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Ventas por Mes', 50, y);

        y += 20;

        // Mini gráfico de barras textual
        const maxCount = Math.max(...sales.by_month.map(m => m.count));
        sales.by_month.forEach((month, i) => {
            if (month.count > 0 || i < dayjs().month()) {
                const barWidth = maxCount > 0 ? (month.count / maxCount) * 250 : 0;

                doc.fontSize(9)
                    .fillColor(COLORS.dark)
                    .font('Helvetica')
                    .text(month.month.substring(0, 3), 50, y, { width: 35 });

                doc.rect(90, y, barWidth, 12)
                    .fill(COLORS.primary);

                doc.fillColor(COLORS.muted)
                    .text(`${month.count} ($${this.formatNumber(month.revenue)})`, 350, y);

                y += 18;
            }
        });

        y += 30;

        // Ventas por tipo de paquete
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Ventas por Tipo de Paquete', 50, y);

        y += 25;

        const packageRows = [['Paquete', 'Cantidad', 'Ingresos']];
        sales.by_package_type.forEach(pkg => {
            packageRows.push([pkg.name, pkg.count, `$${this.formatNumber(pkg.revenue)}`]);
        });

        this.renderTable(doc, 50, y, packageRows, [250, 80, 120]);
    }

    /**
     * Página de top compradoras
     */
    renderTopBuyersPage(doc, topBuyers) {
        this.renderPageHeader(doc, '👑 Top 5 Clientas VIP - 2026');

        let y = 120;

        doc.fontSize(12)
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .text('Clientas con mayor inversión en el año', 50, y);

        y += 30;

        topBuyers.forEach((buyer, index) => {
            const boxHeight = 80;

            // Fondo del card
            doc.roundedRect(50, y, 510, boxHeight, 8)
                .fill(index === 0 ? '#FEF3C7' : COLORS.light);

            // Ranking
            const rankColors = ['#F59E0B', '#9CA3AF', '#B45309'];
            doc.circle(85, y + 40, 18)
                .fill(rankColors[index] || COLORS.muted);

            doc.fontSize(16)
                .fillColor(COLORS.white)
                .font('Helvetica-Bold')
                .text(`${buyer.rank}`, 77, y + 33);

            // Nombre
            doc.fontSize(14)
                .fillColor(COLORS.dark)
                .font('Helvetica-Bold')
                .text(buyer.full_name, 115, y + 15);

            doc.fontSize(10)
                .fillColor(COLORS.muted)
                .font('Helvetica')
                .text(`📞 ${buyer.phone}`, 115, y + 35);

            doc.text(`🎯 Favorito: ${buyer.favorite_package}`, 115, y + 50);

            // Stats
            doc.fontSize(18)
                .fillColor(COLORS.success)
                .font('Helvetica-Bold')
                .text(`$${this.formatNumber(buyer.total_spent)}`, 400, y + 20, { align: 'right', width: 140 });

            doc.fontSize(10)
                .fillColor(COLORS.muted)
                .font('Helvetica')
                .text(`${buyer.total_purchases} compras · ${buyer.total_credits} créditos`, 400, y + 45, { align: 'right', width: 140 });

            y += boxHeight + 15;
        });

        // Insight
        y += 20;
        if (topBuyers.length > 0) {
            const totalVIP = topBuyers.reduce((sum, b) => sum + b.total_spent, 0);
            this.renderInsightBox(doc, 50, y, 510,
                '💎 Programa VIP',
                `Estas 5 clientas representan $${this.formatNumber(totalVIP)} en ingresos. ` +
                `Considera crear un programa de lealtad exclusivo con beneficios como: ` +
                `acceso prioritario a clases, descuentos especiales, y regalos en su cumpleaños.`
            );
        }
    }

    /**
     * Página de ocupación por horario semanal
     */
    renderWeeklySchedulePage(doc, schedule) {
        this.renderPageHeader(doc, '📅 Ocupación por Horario Semanal');

        let y = 110;

        doc.fontSize(12)
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .text('Promedio de asistencia por clase en los últimos 30 días', 50, y);

        y += 30;

        // Calcular promedios globales
        let totalSlots = 0;
        let avgOccupancy = 0;
        let bestSlot = null;
        let worstSlot = null;

        Object.keys(schedule).forEach(day => {
            schedule[day].forEach(slot => {
                totalSlots++;
                avgOccupancy += slot.occupancy_rate;
                if (!bestSlot || slot.occupancy_rate > bestSlot.occupancy_rate) {
                    bestSlot = { ...slot, day_name: day };
                }
                if (!worstSlot || slot.occupancy_rate < worstSlot.occupancy_rate) {
                    worstSlot = { ...slot, day_name: day };
                }
            });
        });

        if (totalSlots > 0) {
            avgOccupancy = Math.round(avgOccupancy / totalSlots);
        }

        // KPIs
        const kpis = [
            { label: 'Ocupación Promedio', value: `${avgOccupancy}%`, color: avgOccupancy >= 70 ? COLORS.success : avgOccupancy >= 40 ? COLORS.warning : COLORS.danger },
            { label: 'Horarios Analizados', value: totalSlots, color: COLORS.primary },
            { label: 'Mejor Horario', value: bestSlot ? `${bestSlot.occupancy_rate}%` : '-', color: COLORS.success },
            { label: 'Peor Horario', value: worstSlot ? `${worstSlot.occupancy_rate}%` : '-', color: COLORS.danger }
        ];

        const boxWidth = 120;
        const boxHeight = 70;
        const gap = 15;

        kpis.forEach((kpi, i) => {
            const x = 50 + (i * (boxWidth + gap));
            this.renderKPIBox(doc, x, y, boxWidth, boxHeight, kpi.label, kpi.value, kpi.color);
        });

        y += boxHeight + 40;

        // Tabla por día
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Detalle por Día', 50, y);

        y += 25;

        // Mostrar los mejores y peores de cada día
        const days = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
        const rows = [['Día', 'Mejor Horario', 'Ocupación', 'Peor Horario', 'Ocupación']];

        days.forEach(day => {
            const slots = schedule[day] || [];
            if (slots.length === 0) return;

            const sorted = [...slots].sort((a, b) => b.occupancy_rate - a.occupancy_rate);
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];

            rows.push([
                day.substring(0, 3),
                best ? best.time : '-',
                best ? `${best.avg_attendance}/${best.max_capacity} (${best.occupancy_rate}%)` : '-',
                worst ? worst.time : '-',
                worst ? `${worst.avg_attendance}/${worst.max_capacity} (${worst.occupancy_rate}%)` : '-'
            ]);
        });

        this.renderTable(doc, 50, y, rows, [60, 90, 120, 90, 120]);

        y += (rows.length * 25) + 30;

        // Insights
        if (bestSlot && worstSlot) {
            this.renderInsightBox(doc, 50, y, 510,
                '📊 Análisis de Ocupación',
                `El horario más popular es ${bestSlot.day_name} a las ${bestSlot.time} con ${bestSlot.occupancy_rate}% de ocupación. ` +
                `El horario menos concurrido es ${worstSlot.day_name} a las ${worstSlot.time} con ${worstSlot.occupancy_rate}%. ` +
                `Considera promocionar los horarios con baja ocupación con descuentos especiales.`
            );
        }
    }

    /**
     * Página de estadísticas de asistencia y clases populares
     */
    renderAttendancePage(doc, attendance, popularClasses) {
        this.renderPageHeader(doc, '🧘 Estadísticas de Asistencia');

        let y = 110;

        // KPIs de asistencia
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Resumen de Asistencia', 50, y);

        y += 25;

        const kpis = [
            { label: 'Total Reservaciones', value: attendance.total_bookings, color: COLORS.primary },
            { label: 'Total Asistentes', value: attendance.total_attendees, color: COLORS.success },
            { label: 'Cancelaciones', value: attendance.cancelled_bookings || 0, color: COLORS.danger }
        ];

        const boxWidth = 160;
        const boxHeight = 70;

        kpis.forEach((kpi, i) => {
            const x = 50 + (i * (boxWidth + 15));
            this.renderKPIBox(doc, x, y, boxWidth, boxHeight, kpi.label, kpi.value, kpi.color);
        });

        y += boxHeight + 40;

        // Asistencia por coach
        if (attendance.by_coach && attendance.by_coach.length > 0) {
            doc.fontSize(14)
                .fillColor(COLORS.dark)
                .font('Helvetica-Bold')
                .text('Asistencia por Coach', 50, y);

            y += 25;

            const coachRows = [['Coach', 'Clases', 'Asistentes', 'Promedio']];
            attendance.by_coach.forEach(coach => {
                const avg = coach.classes > 0 ? Math.round(coach.attendees / coach.classes * 10) / 10 : 0;
                coachRows.push([coach.name, coach.classes, coach.attendees, avg]);
            });

            this.renderTable(doc, 50, y, coachRows, [180, 100, 100, 100]);

            y += (coachRows.length * 25) + 30;
        }

        // Clases populares
        if (popularClasses && popularClasses.length > 0) {
            doc.fontSize(14)
                .fillColor(COLORS.dark)
                .font('Helvetica-Bold')
                .text('Clases Más Populares', 50, y);

            y += 25;

            const classRows = [['Clase', 'Día', 'Reservaciones', 'Asistentes']];
            popularClasses.forEach(cls => {
                classRows.push([cls.name, cls.day, cls.count, cls.attendees]);
            });

            this.renderTable(doc, 50, y, classRows, [200, 100, 100, 100]);

            y += (classRows.length * 25) + 30;
        }

        // Insight
        if (attendance.by_coach && attendance.by_coach.length > 0) {
            const topCoach = attendance.by_coach[0];
            this.renderInsightBox(doc, 50, Math.min(y, 580), 510,
                '👨‍🏫 Rendimiento de Coaches',
                `${topCoach.name} es el coach con más clases (${topCoach.classes}) y ${topCoach.attendees} asistentes totales. ` +
                `Considera reconocer su desempeño y compartir sus mejores prácticas con el equipo.`
            );
        }
    }

    /**
     * Página de clientas dormidas
     */
    renderDormantClientsPage(doc, dormant) {
        this.renderPageHeader(doc, '😴 Clientas Inactivas - Oportunidad de Reactivación');

        let y = 120;

        // Resumen por período
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Resumen de Inactividad', 50, y);

        y += 30;

        const periods = [
            { label: '30+ días sin actividad', value: dormant['30_days'], color: COLORS.warning },
            { label: '60+ días sin actividad', value: dormant['60_days'], color: '#F97316' },
            { label: '90+ días sin actividad', value: dormant['90_days'], color: COLORS.danger }
        ];

        periods.forEach((period, i) => {
            const x = 50 + (i * 175);
            this.renderKPIBox(doc, x, y, 160, 70, period.label, period.value, period.color);
        });

        y += 110;

        // Lista de clientas a contactar
        doc.fontSize(14)
            .fillColor(COLORS.dark)
            .font('Helvetica-Bold')
            .text('Clientas a Contactar (30+ días inactivas)', 50, y);

        y += 25;

        if (dormant.clients_30_days && dormant.clients_30_days.length > 0) {
            const rows = [['Nombre', 'Teléfono', 'Última Actividad', 'Días']];
            dormant.clients_30_days.slice(0, 10).forEach(client => {
                rows.push([
                    client.full_name,
                    client.phone,
                    dayjs(client.last_activity).format('DD/MM/YYYY'),
                    client.days_inactive
                ]);
            });

            this.renderTable(doc, 50, y, rows, [180, 120, 120, 60]);

            y += (rows.length * 25) + 30;
        } else {
            doc.fontSize(12)
                .fillColor(COLORS.success)
                .text('🎉 ¡Excelente! No hay clientas inactivas por más de 30 días.', 50, y);
            y += 40;
        }

        // Estrategias de reactivación
        this.renderInsightBox(doc, 50, y, 510,
            '🎯 Estrategia de Reactivación',
            '1. Envía un WhatsApp personalizado: "Te extrañamos, [Nombre]"\n' +
            '2. Ofrece un descuento exclusivo de regreso (15-20%)\n' +
            '3. Invítalas a una clase especial o evento\n' +
            '4. Pregunta si necesitan flexibilidad de horarios'
        );
    }

    /**
     * Página de recomendaciones
     */
    renderRecommendationsPage(doc, data) {
        this.renderPageHeader(doc, '💡 Recomendaciones y Próximos Pasos');

        let y = 120;

        const recommendations = [
            {
                icon: '🎯',
                title: 'Campaña de Reactivación',
                description: `Tienes ${data.dormant_clients['30_days']} clientas inactivas. Lanza una campaña de WhatsApp con descuento exclusivo.`,
                priority: 'Alta'
            },
            {
                icon: '💎',
                title: 'Programa VIP',
                description: 'Crea un programa de lealtad para tus top compradoras con beneficios exclusivos.',
                priority: 'Media'
            },
            {
                icon: '📱',
                title: 'Recordatorio de Créditos',
                description: `Hay ${data.retention.total_credits_pending} créditos sin usar. Envía recordatorios automáticos.`,
                priority: 'Alta'
            },
            {
                icon: '🎂',
                title: 'Campaña de Cumpleaños',
                description: 'Configura mensajes automáticos de cumpleaños con clase gratis o descuento especial.',
                priority: 'Media'
            },
            {
                icon: '📊',
                title: 'Análisis Mensual',
                description: 'Genera este reporte mensualmente para seguimiento de métricas.',
                priority: 'Baja'
            }
        ];

        recommendations.forEach((rec, i) => {
            const boxHeight = 70;
            const priorityColors = { 'Alta': COLORS.danger, 'Media': COLORS.warning, 'Baja': COLORS.success };

            doc.roundedRect(50, y, 510, boxHeight, 8)
                .fill(COLORS.light);

            // Icono
            doc.fontSize(24)
                .text(rec.icon, 65, y + 20);

            // Contenido
            doc.fontSize(12)
                .fillColor(COLORS.dark)
                .font('Helvetica-Bold')
                .text(rec.title, 105, y + 15);

            doc.fontSize(10)
                .fillColor(COLORS.muted)
                .font('Helvetica')
                .text(rec.description, 105, y + 32, { width: 350 });

            // Prioridad
            doc.roundedRect(470, y + 25, 70, 20, 4)
                .fill(priorityColors[rec.priority]);

            doc.fontSize(9)
                .fillColor(COLORS.white)
                .font('Helvetica-Bold')
                .text(rec.priority, 475, y + 30);

            y += boxHeight + 10;
        });

        // Footer con contacto
        y = 680;
        doc.fontSize(10)
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .text('Generado automáticamente por Rage Web Analytics', 50, y, { align: 'center' });
    }

    // ============ HELPERS ============

    renderPageHeader(doc, title) {
        doc.rect(0, 0, doc.page.width, 80)
            .fill(COLORS.dark);

        doc.fontSize(20)
            .fillColor(COLORS.white)
            .font('Helvetica-Bold')
            .text(title, 50, 30);

        doc.fontSize(10)
            .fillColor(COLORS.muted)
            .text(dayjs().format('DD MMMM YYYY'), 450, 35);
    }

    renderMetricBox(doc, x, y, label, value, color) {
        const width = 120;
        const height = 80;

        doc.roundedRect(x, y, width, height, 8)
            .fill(color);

        doc.fontSize(24)
            .fillColor(COLORS.white)
            .font('Helvetica-Bold')
            .text(String(value), x, y + 15, { width, align: 'center' });

        doc.fontSize(10)
            .font('Helvetica')
            .text(label, x, y + 50, { width, align: 'center' });
    }

    renderKPIBox(doc, x, y, width, height, label, value, color) {
        doc.roundedRect(x, y, width, height, 8)
            .fillAndStroke(COLORS.white, color);

        doc.fontSize(22)
            .fillColor(color)
            .font('Helvetica-Bold')
            .text(String(value), x, y + 15, { width, align: 'center' });

        doc.fontSize(8)
            .fillColor(COLORS.muted)
            .font('Helvetica')
            .text(label, x + 5, y + height - 25, { width: width - 10, align: 'center' });
    }

    renderTable(doc, x, y, rows, colWidths) {
        const rowHeight = 22;

        rows.forEach((row, rowIndex) => {
            let cellX = x;
            const isHeader = rowIndex === 0;

            if (isHeader) {
                doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
                    .fill(COLORS.dark);
            } else if (rowIndex % 2 === 0) {
                doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
                    .fill(COLORS.light);
            }

            row.forEach((cell, colIndex) => {
                doc.fontSize(9)
                    .fillColor(isHeader ? COLORS.white : COLORS.dark)
                    .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                    .text(String(cell), cellX + 5, y + 6, { width: colWidths[colIndex] - 10 });

                cellX += colWidths[colIndex];
            });

            y += rowHeight;
        });
    }

    renderInsightBox(doc, x, y, width, title, text) {
        const padding = 15;

        doc.roundedRect(x, y, width, 100, 8)
            .fill('#EEF2FF');

        doc.roundedRect(x, y, 5, 100, 2)
            .fill(COLORS.primary);

        doc.fontSize(11)
            .fillColor(COLORS.primary)
            .font('Helvetica-Bold')
            .text(title, x + padding, y + padding);

        doc.fontSize(10)
            .fillColor(COLORS.dark)
            .font('Helvetica')
            .text(text, x + padding, y + padding + 18, { width: width - (padding * 2) });
    }

    formatNumber(num) {
        return new Intl.NumberFormat('es-MX').format(num || 0);
    }
}

export default DashboardPDFGenerator;
