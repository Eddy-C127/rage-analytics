/**
 * Analytics Queries Module
 * Consultas analíticas para el dashboard de Rage Web
 * 
 * IMPORTANTE: Requiere SUPABASE_SERVICE_ROLE_KEY para acceder a profiles
 */

import supabase from '../config/supabase.js';
import dayjs from 'dayjs';

// Caché global de perfiles para evitar múltiples consultas
let profilesCache = null;

/**
 * Cargar todos los perfiles al inicio (requiere service_role key para bypasear RLS)
 */
export async function loadProfiles() {
    if (profilesCache) return profilesCache;

    console.log('   📇 Cargando perfiles de usuarios...');

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone');

    if (error) {
        console.log(`   ⚠️  No se pudieron cargar perfiles: ${error.message}`);
        console.log('   💡 Tip: Agrega SUPABASE_SERVICE_ROLE_KEY al archivo .env');
        profilesCache = new Map();
        return profilesCache;
    }

    if (!data || data.length === 0) {
        console.log('   ⚠️  No se encontraron perfiles (posible RLS bloqueando acceso)');
        console.log('   💡 Tip: Usa la service_role key para bypasear RLS');
        profilesCache = new Map();
        return profilesCache;
    }

    profilesCache = new Map(data.map(p => [p.id, p]));
    console.log(`   ✅ ${profilesCache.size} perfiles cargados exitosamente`);
    return profilesCache;
}

/**
 * Obtener perfil de usuario desde caché
 */
function getProfile(userId) {
    if (!profilesCache) return null;
    return profilesCache.get(userId);
}

/**
 * Formatear nombre de usuario (con fallback a ID truncado)
 */
function formatUserName(userId, profile) {
    if (profile?.full_name && profile.full_name.trim()) {
        return profile.full_name;
    }
    return 'Usuario ' + userId.substring(0, 8);
}

/**
 * Formatear teléfono (con fallback)
 */
function formatPhone(profile) {
    if (profile?.phone && profile.phone.trim()) {
        return profile.phone;
    }
    return 'Sin teléfono';
}

/**
 * 1. CLIENTAS DORMIDAS - Para campañas de reintegración
 * Encuentra clientas que reservaron pero no han vuelto recientemente
 */
export async function getDormantClients(daysInactive = 30) {
    // Obtener última reserva de cada usuario
    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('user_id, session_date, created_at')
        .eq('status', 'active')
        .order('session_date', { ascending: false });

    if (bookingsError) throw bookingsError;

    // Obtener última compra de créditos
    const { data: creditBatches, error: batchesError } = await supabase
        .from('credit_batches')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

    if (batchesError) throw batchesError;

    // Combinar actividad y encontrar última fecha por usuario
    const userActivity = new Map();

    bookings?.forEach(b => {
        const current = userActivity.get(b.user_id);
        const bookingDate = b.session_date || b.created_at;
        if (!current || dayjs(bookingDate).isAfter(dayjs(current.date))) {
            userActivity.set(b.user_id, { date: bookingDate, type: 'booking' });
        }
    });

    creditBatches?.forEach(c => {
        const current = userActivity.get(c.user_id);
        if (!current || dayjs(c.created_at).isAfter(dayjs(current.date))) {
            userActivity.set(c.user_id, { date: c.created_at, type: 'purchase' });
        }
    });

    // Filtrar inactivos
    const cutoffDate = dayjs().subtract(daysInactive, 'day');
    const dormantUserIds = [];

    userActivity.forEach((activity, userId) => {
        if (dayjs(activity.date).isBefore(cutoffDate)) {
            dormantUserIds.push({
                user_id: userId,
                last_activity: activity.date,
                last_activity_type: activity.type,
                days_inactive: dayjs().diff(dayjs(activity.date), 'day')
            });
        }
    });

    // Usar caché de perfiles
    const dormantClients = dormantUserIds.map(d => {
        const profile = getProfile(d.user_id);
        return {
            ...d,
            full_name: formatUserName(d.user_id, profile),
            phone: formatPhone(profile)
        };
    }).sort((a, b) => b.days_inactive - a.days_inactive);

    return {
        total: dormantClients.length,
        cutoff_days: daysInactive,
        clients: dormantClients
    };
}

/**
 * 2. VENTAS/CRÉDITOS POR MES Y TIPO DE PAQUETE
 * Basado en credit_batches ya que es lo que representa las ventas
 */
export async function getPackageSalesByMonth(year = 2026) {
    const { data: creditBatches, error: batchesError } = await supabase
        .from('credit_batches')
        .select(`
      id,
      user_id,
      package_id,
      credits_total,
      created_at
    `)
        .gte('created_at', `${year}-01-01`)
        .lte('created_at', `${year}-12-31`)
        .order('created_at', { ascending: true });

    if (batchesError) throw batchesError;

    // Obtener paquetes para mapear nombres y precios
    const { data: packages, error: pkgError } = await supabase
        .from('packages')
        .select('id, title, price, classes_count');

    if (pkgError) throw pkgError;

    const packageMap = new Map(packages?.map(p => [p.id, p]) || []);

    // Agrupar por mes
    const salesByMonth = {};
    const salesByPackageType = {};
    let totalRevenue = 0;
    let totalPackages = 0;

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Inicializar meses
    months.forEach((month, i) => {
        salesByMonth[i + 1] = { month, count: 0, revenue: 0, credits: 0 };
    });

    creditBatches?.forEach(batch => {
        const month = dayjs(batch.created_at).month() + 1;
        const pkg = packageMap.get(batch.package_id);
        const packageName = pkg?.title || 'Paquete Desconocido';
        const amount = pkg?.price || 0;

        // Por mes
        salesByMonth[month].count++;
        salesByMonth[month].revenue += amount;
        salesByMonth[month].credits += batch.credits_total || 0;

        // Por tipo
        if (!salesByPackageType[packageName]) {
            salesByPackageType[packageName] = {
                count: 0,
                revenue: 0,
                credits: 0,
                price: pkg?.price || 0
            };
        }
        salesByPackageType[packageName].count++;
        salesByPackageType[packageName].revenue += amount;
        salesByPackageType[packageName].credits += batch.credits_total || 0;

        totalRevenue += amount;
        totalPackages++;
    });

    return {
        year,
        total_packages: totalPackages,
        total_revenue: totalRevenue,
        by_month: Object.values(salesByMonth),
        by_package_type: Object.entries(salesByPackageType)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count)
    };
}

/**
 * 3. TOP CLIENTAS CON MÁS COMPRAS
 */
export async function getTopBuyers(year = 2026, limit = 5) {
    const { data: creditBatches, error: batchesError } = await supabase
        .from('credit_batches')
        .select(`
      user_id,
      package_id,
      credits_total,
      created_at
    `)
        .gte('created_at', `${year}-01-01`)
        .lte('created_at', `${year}-12-31`);

    if (batchesError) throw batchesError;

    // Obtener paquetes
    const { data: packages } = await supabase
        .from('packages')
        .select('id, title, price');

    const packageMap = new Map(packages?.map(p => [p.id, p]) || []);

    // Agrupar por usuario
    const userStats = {};

    creditBatches?.forEach(batch => {
        const pkg = packageMap.get(batch.package_id);
        const amount = pkg?.price || 0;

        if (!userStats[batch.user_id]) {
            userStats[batch.user_id] = {
                user_id: batch.user_id,
                total_purchases: 0,
                total_spent: 0,
                total_credits: 0,
                packages: []
            };
        }

        userStats[batch.user_id].total_purchases++;
        userStats[batch.user_id].total_spent += amount;
        userStats[batch.user_id].total_credits += batch.credits_total || 0;
        userStats[batch.user_id].packages.push(pkg?.title || 'Desconocido');
    });

    // Ordenar por total gastado
    const topBuyers = Object.values(userStats)
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, limit);

    // Usar caché de perfiles
    return topBuyers.map((buyer, index) => {
        const profile = getProfile(buyer.user_id);
        return {
            rank: index + 1,
            ...buyer,
            full_name: formatUserName(buyer.user_id, profile),
            phone: formatPhone(profile),
            favorite_package: getMostFrequent(buyer.packages)
        };
    });
}

/**
 * 4. MÉTRICAS DE RETENCIÓN
 */
export async function getRetentionMetrics() {
    const now = dayjs();
    const thirtyDaysAgo = now.subtract(30, 'day').format('YYYY-MM-DD');

    // Total de usuarios únicos con actividad
    const { data: allBookings } = await supabase
        .from('bookings')
        .select('user_id');

    const totalUniqueUsers = new Set(allBookings?.map(b => b.user_id)).size;

    // Activos en últimos 30 días (con reservas)
    const { data: recentBookings } = await supabase
        .from('bookings')
        .select('user_id')
        .gte('session_date', thirtyDaysAgo);

    const activeUsers30 = new Set(recentBookings?.map(b => b.user_id)).size;

    // Usuarios con compras
    const { data: allBatches } = await supabase
        .from('credit_batches')
        .select('user_id, created_at');

    const buyersTotal = new Set(allBatches?.map(b => b.user_id)).size;
    const buyers30 = new Set(
        allBatches?.filter(b => dayjs(b.created_at).isAfter(now.subtract(30, 'day')))
            .map(b => b.user_id)
    ).size;

    // Usuarios con créditos disponibles
    const { data: activeBatches } = await supabase
        .from('credit_batches')
        .select('user_id, credits_remaining')
        .gt('credits_remaining', 0);

    const usersWithCredits = new Set(activeBatches?.map(b => b.user_id)).size;
    const totalCreditsAvailable = activeBatches?.reduce((sum, b) => sum + b.credits_remaining, 0) || 0;

    // Usar caché de perfiles para contar
    const profileCount = profilesCache?.size || totalUniqueUsers;

    return {
        total_registered_users: profileCount,
        total_unique_users: totalUniqueUsers,
        active_users_30_days: activeUsers30,
        total_buyers_ever: buyersTotal,
        buyers_last_30_days: buyers30,
        users_with_credits: usersWithCredits,
        total_credits_pending: totalCreditsAvailable,
        retention_rate: totalUniqueUsers > 0 ? ((activeUsers30 / totalUniqueUsers) * 100).toFixed(1) : 0,
        conversion_rate: totalUniqueUsers > 0 ? ((buyersTotal / totalUniqueUsers) * 100).toFixed(1) : 0
    };
}

/**
 * 5. ANÁLISIS DE CLASES MÁS POPULARES
 */
export async function getPopularClasses() {
    // Obtener sessions
    const { data: sessions } = await supabase
        .from('sessions')
        .select('id, class_name, class_subtitle, day_name');

    // Contar bookings por horario
    const { data: bookings } = await supabase
        .from('bookings')
        .select('session_date, total_attendees, status')
        .eq('status', 'active');

    // Agrupar por día de la semana
    const dayStats = {};

    sessions?.forEach(s => {
        dayStats[s.day_name] = {
            name: s.class_name,
            subtitle: s.class_subtitle,
            day: s.day_name,
            count: 0,
            attendees: 0
        };
    });

    // Mapear días de la semana
    const dayMap = {
        0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIÉRCOLES',
        4: 'JUEVES', 5: 'VIERNES', 6: 'SÁBADO'
    };

    bookings?.forEach(b => {
        const dayOfWeek = dayjs(b.session_date).day();
        const dayName = dayMap[dayOfWeek];
        if (dayStats[dayName]) {
            dayStats[dayName].count++;
            dayStats[dayName].attendees += b.total_attendees || 1;
        }
    });

    return Object.values(dayStats)
        .filter(d => d.count > 0)
        .sort((a, b) => b.attendees - a.attendees);
}

/**
 * 6. ESTADÍSTICAS DE ASISTENCIA
 */
export async function getAttendanceStats() {
    const { data: bookings } = await supabase
        .from('bookings')
        .select('session_date, session_time, total_attendees, status, coach_name')
        .eq('status', 'active');

    // Agrupar por coach
    const coachStats = {};

    bookings?.forEach(b => {
        if (!coachStats[b.coach_name]) {
            coachStats[b.coach_name] = { name: b.coach_name, classes: 0, attendees: 0 };
        }
        coachStats[b.coach_name].classes++;
        coachStats[b.coach_name].attendees += b.total_attendees || 1;
    });

    // Horarios más populares
    const timeStats = {};
    bookings?.forEach(b => {
        if (!timeStats[b.session_time]) {
            timeStats[b.session_time] = { time: b.session_time, count: 0, attendees: 0 };
        }
        timeStats[b.session_time].count++;
        timeStats[b.session_time].attendees += b.total_attendees || 1;
    });

    return {
        by_coach: Object.values(coachStats).sort((a, b) => b.attendees - a.attendees),
        by_time: Object.values(timeStats).sort((a, b) => b.count - a.count),
        total_bookings: bookings?.length || 0,
        total_attendees: bookings?.reduce((sum, b) => sum + (b.total_attendees || 1), 0) || 0
    };
}

/**
 * 7. RESUMEN GENERAL DEL DASHBOARD
 */
export async function getDashboardSummary() {
    // Primero cargar perfiles
    await loadProfiles();

    console.log('📊 Generando resumen del dashboard...');

    const [retention, sales, topBuyers, popularClasses, attendance, dormant30, dormant60, dormant90] =
        await Promise.all([
            getRetentionMetrics(),
            getPackageSalesByMonth(2026),
            getTopBuyers(2026, 5),
            getPopularClasses(),
            getAttendanceStats(),
            getDormantClients(30),
            getDormantClients(60),
            getDormantClients(90)
        ]);

    return {
        generated_at: new Date().toISOString(),
        retention,
        sales,
        top_buyers: topBuyers,
        popular_classes: popularClasses.slice(0, 5),
        attendance,
        dormant_clients: {
            '30_days': dormant30.total,
            '60_days': dormant60.total,
            '90_days': dormant90.total,
            clients_30_days: dormant30.clients.slice(0, 10)
        }
    };
}

// Helper function
function getMostFrequent(arr) {
    if (!arr || arr.length === 0) return 'N/A';
    const counts = {};
    arr.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
}

/**
 * VENTAS POR RANGO DE FECHAS
 */
export async function getPackageSalesByDateRange(startDate, endDate) {
    const { data: creditBatches, error: batchesError } = await supabase
        .from('credit_batches')
        .select(`
            id,
            user_id,
            package_id,
            credits_total,
            created_at
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

    if (batchesError) throw batchesError;

    const { data: packages, error: pkgError } = await supabase
        .from('packages')
        .select('id, title, price, classes_count');

    if (pkgError) throw pkgError;

    const packageMap = new Map(packages?.map(p => [p.id, p]) || []);

    const salesByMonth = {};
    const salesByPackageType = {};
    let totalRevenue = 0;
    let totalPackages = 0;

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    creditBatches?.forEach(batch => {
        const monthIndex = dayjs(batch.created_at).month();
        const monthKey = `${dayjs(batch.created_at).year()}-${monthIndex}`;
        const pkg = packageMap.get(batch.package_id);
        const packageName = pkg?.title || 'Paquete Desconocido';
        const amount = pkg?.price || 0;

        if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = {
                month: months[monthIndex],
                year: dayjs(batch.created_at).year(),
                count: 0,
                revenue: 0,
                credits: 0
            };
        }
        salesByMonth[monthKey].count++;
        salesByMonth[monthKey].revenue += amount;
        salesByMonth[monthKey].credits += batch.credits_total || 0;

        if (!salesByPackageType[packageName]) {
            salesByPackageType[packageName] = {
                count: 0,
                revenue: 0,
                credits: 0,
                price: pkg?.price || 0
            };
        }
        salesByPackageType[packageName].count++;
        salesByPackageType[packageName].revenue += amount;
        salesByPackageType[packageName].credits += batch.credits_total || 0;

        totalRevenue += amount;
        totalPackages++;
    });

    return {
        startDate,
        endDate,
        total_packages: totalPackages,
        total_revenue: totalRevenue,
        by_month: Object.values(salesByMonth).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return months.indexOf(a.month) - months.indexOf(b.month);
        }),
        by_package_type: Object.entries(salesByPackageType)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count)
    };
}

/**
 * TOP COMPRADORAS POR RANGO DE FECHAS
 */
export async function getTopBuyersByDateRange(startDate, endDate, limit = 5) {
    const { data: creditBatches, error: batchesError } = await supabase
        .from('credit_batches')
        .select(`
            user_id,
            package_id,
            credits_total,
            created_at
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    if (batchesError) throw batchesError;

    const { data: packages } = await supabase
        .from('packages')
        .select('id, title, price');

    const packageMap = new Map(packages?.map(p => [p.id, p]) || []);

    const userStats = {};

    creditBatches?.forEach(batch => {
        const pkg = packageMap.get(batch.package_id);
        const amount = pkg?.price || 0;

        if (!userStats[batch.user_id]) {
            userStats[batch.user_id] = {
                user_id: batch.user_id,
                total_purchases: 0,
                total_spent: 0,
                total_credits: 0,
                packages: []
            };
        }

        userStats[batch.user_id].total_purchases++;
        userStats[batch.user_id].total_spent += amount;
        userStats[batch.user_id].total_credits += batch.credits_total || 0;
        userStats[batch.user_id].packages.push(pkg?.title || 'Desconocido');
    });

    const topBuyers = Object.values(userStats)
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, limit);

    return topBuyers.map((buyer, index) => {
        const profile = getProfile(buyer.user_id);
        return {
            rank: index + 1,
            ...buyer,
            full_name: formatUserName(buyer.user_id, profile),
            phone: formatPhone(profile),
            favorite_package: getMostFrequent(buyer.packages)
        };
    });
}

/**
 * HORARIO SEMANAL CON OCUPACIÓN
 * Analiza los bookings de los últimos 30 días para determinar ocupación promedio por horario
 * 
 * Lógica:
 * 1. Agrupar todos los bookings por fecha+hora específica (ej: 2026-01-15 a las 09:00)
 * 2. Sumar total de asistentes por cada clase específica
 * 3. Luego promediar por día de la semana + hora
 */
export async function getWeeklySchedule() {
    // Obtener bookings de los últimos 30 días (solo activos/completados)
    const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const { data: bookings, error: bookErr } = await supabase
        .from('bookings')
        .select('session_date, session_time, total_attendees, status, coach_name')
        .in('status', ['active', 'completed'])
        .gte('session_date', thirtyDaysAgo);

    if (bookErr) {
        console.error('Error fetching bookings:', bookErr);
        return {};
    }

    // Obtener sesiones para metadata de clases
    const { data: sessions } = await supabase
        .from('sessions')
        .select('day_name, class_name, class_subtitle, max_spots');

    // Crear mapa de clase por día desde sessions
    const sessionMap = new Map();
    sessions?.forEach(s => {
        if (!sessionMap.has(s.day_name)) {
            sessionMap.set(s.day_name, {
                class_name: s.class_name,
                subtitle: s.class_subtitle,
                max_capacity: s.max_spots || 14
            });
        }
    });

    // Mapear días
    const dayOrder = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const dayMap = { 0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIÉRCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SÁBADO' };

    // PASO 1: Agrupar bookings por fecha+hora específica
    // Esto nos da el total de reservas por cada clase individual
    const classesByDatetime = {};

    bookings?.forEach(b => {
        const time = b.session_time?.substring(0, 5) || b.session_time;
        const key = `${b.session_date}-${time}`;

        if (!classesByDatetime[key]) {
            classesByDatetime[key] = {
                date: b.session_date,
                time: time,
                total_attendees: 0
            };
        }
        classesByDatetime[key].total_attendees += b.total_attendees || 1;
    });

    // PASO 2: Agrupar por día de la semana + hora y promediar
    const scheduleStats = {};

    Object.values(classesByDatetime).forEach(cls => {
        const dayOfWeek = dayjs(cls.date).day();
        const dayName = dayMap[dayOfWeek];
        const key = `${dayName}-${cls.time}`;

        if (!scheduleStats[key]) {
            const sessionInfo = sessionMap.get(dayName) || {};
            scheduleStats[key] = {
                day: dayName,
                time: cls.time,
                class_name: sessionInfo.class_name || 'Clase',
                subtitle: sessionInfo.subtitle || '',
                max_capacity: sessionInfo.max_capacity || 14,
                total_classes: 0, // Número de clases (semanas) analizadas
                total_attendees: 0, // Suma total de asistentes
                attendees_per_class: [], // Lista de asistentes por cada clase
                avg_attendance: 0,
                occupancy_rate: 0
            };
        }

        scheduleStats[key].total_classes++;
        scheduleStats[key].total_attendees += cls.total_attendees;
        scheduleStats[key].attendees_per_class.push(cls.total_attendees);
    });

    // PASO 3: Calcular promedios
    Object.values(scheduleStats).forEach(s => {
        if (s.total_classes > 0) {
            s.avg_attendance = Math.round(s.total_attendees / s.total_classes * 10) / 10;
            s.occupancy_rate = Math.round((s.avg_attendance / s.max_capacity) * 100);
        }
        // Eliminar el array temporal para no enviarlo al frontend
        delete s.attendees_per_class;
    });

    // Organizar por día
    const byDay = {};
    dayOrder.forEach(day => {
        byDay[day] = Object.values(scheduleStats)
            .filter(s => s.day === day)
            .sort((a, b) => a.time.localeCompare(b.time));
    });

    return byDay;
}

/**
 * HISTORIAL DE COMPRAS DE UN USUARIO
 */
export async function getUserPurchaseHistory(userId) {
    const { data: creditBatches, error } = await supabase
        .from('credit_batches')
        .select('id, package_id, credits_total, credits_remaining, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // Obtener paquetes
    const { data: packages } = await supabase
        .from('packages')
        .select('id, title, price');

    const packageMap = new Map(packages?.map(p => [p.id, p]) || []);

    return creditBatches?.map(batch => {
        const pkg = packageMap.get(batch.package_id);
        return {
            id: batch.id,
            date: batch.created_at,
            package_name: pkg?.title || 'Desconocido',
            price: pkg?.price || 0,
            credits_total: batch.credits_total,
            credits_remaining: batch.credits_remaining
        };
    }) || [];
}

/**
 * COMPARATIVA DE CRÉDITOS Y CLIENTAS RECURRENTES
 */
export async function getCreditsComparison(period1Start, period1End, period2Start, period2End) {
    // Period 1
    const { data: batches1 } = await supabase
        .from('credit_batches')
        .select('user_id, credits_total, created_at')
        .gte('created_at', period1Start)
        .lte('created_at', period1End);

    const { data: bookings1 } = await supabase
        .from('bookings')
        .select('user_id, total_attendees')
        .eq('status', 'active')
        .gte('session_date', period1Start)
        .lte('session_date', period1End);

    // Period 2
    const { data: batches2 } = await supabase
        .from('credit_batches')
        .select('user_id, credits_total, created_at')
        .gte('created_at', period2Start)
        .lte('created_at', period2End);

    const { data: bookings2 } = await supabase
        .from('bookings')
        .select('user_id, total_attendees')
        .eq('status', 'active')
        .gte('session_date', period2Start)
        .lte('session_date', period2End);

    // Calculate stats
    const users1 = new Set(batches1?.map(b => b.user_id) || []);
    const users2 = new Set(batches2?.map(b => b.user_id) || []);

    // Recurring: clients who bought in both periods
    const recurring = [...users1].filter(u => users2.has(u));

    return {
        period1: {
            credits_purchased: batches1?.reduce((sum, b) => sum + (b.credits_total || 0), 0) || 0,
            credits_used: bookings1?.reduce((sum, b) => sum + (b.total_attendees || 1), 0) || 0,
            unique_buyers: users1.size,
            active_clients: new Set(bookings1?.map(b => b.user_id) || []).size
        },
        period2: {
            credits_purchased: batches2?.reduce((sum, b) => sum + (b.credits_total || 0), 0) || 0,
            credits_used: bookings2?.reduce((sum, b) => sum + (b.total_attendees || 1), 0) || 0,
            unique_buyers: users2.size,
            active_clients: new Set(bookings2?.map(b => b.user_id) || []).size
        },
        recurring_clients: recurring.length,
        recurring_percentage: users1.size > 0 ? Math.round((recurring.length / users1.size) * 100) : 0
    };
}

/**
 * CLIENTAS DORMIDAS CON PAGINACIÓN
 */
export async function getDormantClientsPaginated(daysInactive = 30, page = 1, pageSize = 20) {
    const result = await getDormantClients(daysInactive);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
        ...result,
        clients: result.clients.slice(startIndex, endIndex),
        pagination: {
            page,
            pageSize,
            totalPages: Math.ceil(result.total / pageSize),
            totalItems: result.total
        }
    };
}

export default {
    loadProfiles,
    getDormantClients,
    getDormantClientsPaginated,
    getPackageSalesByMonth,
    getPackageSalesByDateRange,
    getTopBuyers,
    getTopBuyersByDateRange,
    getUserPurchaseHistory,
    getRetentionMetrics,
    getPopularClasses,
    getWeeklySchedule,
    getAttendanceStats,
    getCreditsComparison,
    getDashboardSummary
};
