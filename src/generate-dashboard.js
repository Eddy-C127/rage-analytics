/**
 * Rage Web Analytics - Dashboard Generator
 * 
 * Genera reportes PDF con métricas clave para:
 * - Retención y fidelización de clientas
 * - Ventas de paquetes por período y tipo
 * - Identificación de clientas VIP
 * - Campañas de reactivación
 */

import analytics from './queries/analytics.js';
import DashboardPDFGenerator from './generators/pdf-generator.js';
import fs from 'fs';
import dayjs from 'dayjs';
import 'dayjs/locale/es.js';

dayjs.locale('es');

async function generateDashboard() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           RAGE WEB - ANALYTICS DASHBOARD                 ║');
    console.log('║           Generador de Reportes PDF                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📅 Fecha: ${dayjs().format('dddd, DD [de] MMMM [de] YYYY')}`);
    console.log(`⏰ Hora: ${dayjs().format('HH:mm:ss')}`);
    console.log('');
    console.log('─'.repeat(60));

    try {
        // PRIMERO: Cargar todos los perfiles para tener nombres y teléfonos
        await analytics.loadProfiles();

        // 1. Obtener métricas de retención
        console.log('\n📊 Obteniendo métricas de retención...');
        const retention = await analytics.getRetentionMetrics();
        console.log(`   ✅ ${retention.total_unique_users} usuarios únicos con actividad`);
        console.log(`   ✅ ${retention.active_users_30_days} activos (últimos 30 días)`);
        console.log(`   ✅ Tasa de retención: ${retention.retention_rate}%`);
        console.log(`   ✅ ${retention.users_with_credits} usuarios con créditos disponibles`);
        console.log(`   ✅ ${retention.total_credits_pending} créditos pendientes de usar`);

        // 2. Obtener ventas por mes
        console.log('\n💰 Analizando ventas 2026...');
        const sales = await analytics.getPackageSalesByMonth(2026);
        console.log(`   ✅ ${sales.total_packages} paquetes vendidos`);
        console.log(`   ✅ $${new Intl.NumberFormat('es-MX').format(sales.total_revenue)} en ingresos`);

        if (sales.by_package_type.length > 0) {
            console.log('\n   📦 Desglose por tipo de paquete:');
            sales.by_package_type.slice(0, 5).forEach(pkg => {
                console.log(`      - ${pkg.name}: ${pkg.count} vendidos ($${new Intl.NumberFormat('es-MX').format(pkg.revenue)})`);
            });
        }

        // 3. Top compradoras
        console.log('\n👑 Identificando Top 5 clientas VIP...');
        const topBuyers = await analytics.getTopBuyers(2026, 5);
        if (topBuyers.length > 0) {
            topBuyers.forEach((buyer, i) => {
                console.log(`   ${i + 1}. ${buyer.full_name} - $${new Intl.NumberFormat('es-MX').format(buyer.total_spent)} (${buyer.total_purchases} compras)`);
            });
        } else {
            console.log('   ⚠️  No hay compras registradas en 2026');
        }

        // 4. Clases populares
        console.log('\n🧘 Analizando clases populares...');
        const popularClasses = await analytics.getPopularClasses();
        if (popularClasses.length > 0) {
            popularClasses.slice(0, 5).forEach((cls, i) => {
                console.log(`   ${i + 1}. ${cls.name} (${cls.day}) - ${cls.attendees} asistentes en ${cls.count} reservaciones`);
            });
        }

        // 5. Estadísticas de asistencia
        console.log('\n📈 Analizando estadísticas de asistencia...');
        const attendance = await analytics.getAttendanceStats();
        console.log(`   ✅ Total reservaciones: ${attendance.total_bookings}`);
        console.log(`   ✅ Total asistentes: ${attendance.total_attendees}`);

        if (attendance.by_coach.length > 0) {
            console.log('\n   👨‍🏫 Por coach:');
            attendance.by_coach.slice(0, 3).forEach(coach => {
                console.log(`      - ${coach.name}: ${coach.classes} clases, ${coach.attendees} asistentes`);
            });
        }

        // 6. Clientas dormidas
        console.log('\n😴 Buscando clientas inactivas...');
        const dormant30 = await analytics.getDormantClients(30);
        const dormant60 = await analytics.getDormantClients(60);
        const dormant90 = await analytics.getDormantClients(90);
        console.log(`   ⚠️  ${dormant30.total} inactivas 30+ días`);
        console.log(`   ⚠️  ${dormant60.total} inactivas 60+ días`);
        console.log(`   ⚠️  ${dormant90.total} inactivas 90+ días`);

        // 7. Horario Semanal
        console.log('\n📅 Analizando ocupación por horario...');
        const weeklySchedule = await analytics.getWeeklySchedule();
        const scheduleDays = Object.keys(weeklySchedule);
        let totalSlots = 0;
        let avgOccupancy = 0;
        scheduleDays.forEach(day => {
            weeklySchedule[day].forEach(slot => {
                totalSlots++;
                avgOccupancy += slot.occupancy_rate;
            });
        });
        if (totalSlots > 0) {
            avgOccupancy = Math.round(avgOccupancy / totalSlots);
            console.log(`   ✅ ${totalSlots} horarios analizados`);
            console.log(`   ✅ Ocupación promedio: ${avgOccupancy}%`);
        }

        // Compilar datos
        const dashboardData = {
            generated_at: new Date().toISOString(),
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

        // 7. Generar PDF
        console.log('\n─'.repeat(60));
        console.log('\n📄 Generando reporte PDF...');
        const pdfGenerator = new DashboardPDFGenerator('./reports');
        const pdfPath = await pdfGenerator.generateFullReport(dashboardData);

        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ COMPLETADO                         ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`\n📁 Reporte PDF guardado en: ${pdfPath}`);

        // También guardar JSON para referencia
        const jsonPath = pdfPath.replace('.pdf', '.json');
        fs.writeFileSync(jsonPath, JSON.stringify(dashboardData, null, 2));
        console.log(`📋 Datos JSON guardados en: ${jsonPath}`);

        console.log('\n💡 Próximos pasos sugeridos:');
        console.log('   1. Abre el PDF para revisar el reporte completo');
        console.log('   2. Identifica las clientas inactivas para campaña de reactivación');
        console.log('   3. Contacta a las top clientas para programa VIP');
        console.log('   4. Envía recordatorios a clientas con créditos pendientes');
        console.log('\n');

    } catch (error) {
        console.error('\n❌ Error al generar dashboard:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar
generateDashboard();
