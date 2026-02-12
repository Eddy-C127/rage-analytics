/**
 * Rage Analytics Dashboard - Frontend Application v2.0
 */

// ============ GLOBALS ============
const API_BASE = '';
let currentSection = 'dashboard';
let currentFilters = { startDate: null, endDate: null, year: 2026 };
let weeklyScheduleData = null;
let dormantPagination = { page: 1, pageSize: 20, totalPages: 1 };

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    updateCurrentDate();
    initializeDateFilters();
    setupNavigation();
    setupFilters();
    setupCompare();
    setupDormant();
    setupModal();
    setupMobileMenu();
    await loadDashboardData();
    await loadReports();
}

function updateCurrentDate() {
    const dateEl = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('es-MX', options);
}

function initializeDateFilters() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    document.getElementById('start-date').value = formatDateForInput(startOfYear);
    document.getElementById('end-date').value = formatDateForInput(now);

    // Compare section - default to last month vs this month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    document.getElementById('period1-start').value = formatDateForInput(lastMonthStart);
    document.getElementById('period1-end').value = formatDateForInput(lastMonthEnd);
    document.getElementById('period2-start').value = formatDateForInput(thisMonthStart);
    document.getElementById('period2-end').value = formatDateForInput(now);

    currentFilters.startDate = formatDateForInput(startOfYear);
    currentFilters.endDate = formatDateForInput(now);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

// ============ MOBILE MENU ============
function setupMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');

    toggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close on nav item click
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });
}

// ============ NAVIGATION ============
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            navigateToSection(section);
        });
    });
}

function navigateToSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `section-${section}`);
    });

    const titles = {
        dashboard: ['Dashboard General', 'Resumen de métricas en tiempo real'],
        sales: ['Análisis de Ventas', 'Ventas por período y tipo de paquete'],
        clients: ['Clientas VIP', 'Top compradoras con mayor inversión'],
        compare: ['Comparativas', 'Compara períodos para medir crecimiento'],
        dormant: ['Campaña de Reactivación', 'Clientas inactivas que necesitan atención'],
        reports: ['Reportes PDF', 'Historial de reportes generados']
    };

    document.getElementById('page-title').textContent = titles[section][0];
    document.getElementById('page-subtitle').textContent = titles[section][1];

    currentSection = section;

    if (section === 'clients') loadTopBuyers();
    if (section === 'dormant') loadDormant();
    if (section === 'reports') loadReports();
    if (section === 'sales') loadSalesData();
}

// ============ FILTERS ============
function setupFilters() {
    document.getElementById('quick-period').addEventListener('change', handleQuickPeriod);
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('generate-pdf').addEventListener('click', generatePDF);
}

function handleQuickPeriod(e) {
    const value = e.target.value;
    const now = new Date();
    let start, end;

    switch (value) {
        case 'this-month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = now;
            break;
        case 'last-month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'this-quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
            end = now;
            break;
        case 'this-year':
            start = new Date(now.getFullYear(), 0, 1);
            end = now;
            break;
        case 'last-year':
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
            break;
        default:
            return;
    }

    document.getElementById('start-date').value = formatDateForInput(start);
    document.getElementById('end-date').value = formatDateForInput(end);
}

async function applyFilters() {
    currentFilters.startDate = document.getElementById('start-date').value;
    currentFilters.endDate = document.getElementById('end-date').value;

    showToast('Aplicando filtros...');

    // Always reload dashboard data
    await loadDashboardData();

    // Also reload current section if it has date-dependent data
    switch (currentSection) {
        case 'clients':
            await loadTopBuyers();
            break;
        case 'sales':
            await loadSalesData();
            break;
        case 'dormant':
            dormantPagination.page = 1;
            await loadDormant();
            break;
    }

    showToast('Filtros aplicados', 'success');
}

// ============ API CALLS ============
async function apiCall(endpoint, data = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error de conexión', 'error');
        return { success: false, error: error.message };
    }
}

async function apiGet(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

// ============ LOAD DATA ============
async function loadDashboardData() {
    const retention = await apiCall('/api/analytics/retention');
    if (retention.success) updateRetentionUI(retention.data);

    const sales = await apiCall('/api/analytics/sales', {
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate
    });
    if (sales.success) updateSalesUI(sales.data);

    // Load weekly schedule
    const schedule = await apiCall('/api/analytics/weekly-schedule');
    if (schedule.success) {
        weeklyScheduleData = schedule.data;
        setupScheduleTabs();
        updateScheduleUI('LUNES');
    }

    const dormant = await apiCall('/api/analytics/dormant', { daysInactive: 30 });
    if (dormant.success) {
        document.getElementById('kpi-credits').textContent = formatNumber(dormant.data.total);
    }
}

function updateRetentionUI(data) {
    document.getElementById('kpi-users').textContent = formatNumber(data.total_registered_users);
    document.getElementById('retention-rate').textContent = `${data.retention_rate}%`;
    document.getElementById('conversion-rate').textContent = `${data.conversion_rate}%`;
    document.getElementById('active-users').textContent = formatNumber(data.active_users_30_days);
    document.getElementById('users-credits').textContent = formatNumber(data.users_with_credits);
}

function updateSalesUI(data) {
    document.getElementById('kpi-revenue').textContent = `$${formatNumber(data.total_revenue)}`;
    document.getElementById('kpi-packages').textContent = formatNumber(data.total_packages);

    // Sales chart
    const chartEl = document.getElementById('sales-chart');
    const maxRevenue = Math.max(...data.by_month.map(m => m.revenue), 1);

    if (data.by_month.length === 0) {
        chartEl.innerHTML = '<p class="info-message">No hay ventas en este período</p>';
        return;
    }

    chartEl.innerHTML = data.by_month
        .filter(m => m.count > 0)
        .map(month => `
            <div class="chart-bar">
                <span class="chart-label">${month.month.substring(0, 3)} ${month.year || ''}</span>
                <div class="chart-bar-container">
                    <div class="chart-bar-fill" style="width: ${(month.revenue / maxRevenue * 100)}%"></div>
                </div>
                <span class="chart-value">${month.count} ventas · $${formatNumber(month.revenue)}</span>
            </div>
        `).join('');
}

// ============ WEEKLY SCHEDULE ============
function setupScheduleTabs() {
    document.querySelectorAll('.schedule-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateScheduleUI(tab.dataset.day);
        });
    });
}

function updateScheduleUI(day) {
    const el = document.getElementById('schedule-content');
    if (!weeklyScheduleData || !weeklyScheduleData[day]) {
        el.innerHTML = '<p class="info-message">No hay clases programadas este día</p>';
        return;
    }

    const classes = weeklyScheduleData[day];
    if (classes.length === 0) {
        el.innerHTML = '<p class="info-message">No hay clases programadas este día</p>';
        return;
    }

    el.innerHTML = `
        <div class="schedule-grid">
            ${classes.map(cls => {
        const occupancyClass = cls.occupancy_rate >= 80 ? 'high' :
            cls.occupancy_rate >= 50 ? 'medium' : 'low';
        return `
                    <div class="schedule-card occupancy-${occupancyClass}">
                        <div class="schedule-time">${cls.time}</div>
                        <div class="schedule-class">${cls.class_name}</div>
                        <div class="schedule-subtitle">${cls.subtitle || ''}</div>
                        <div class="schedule-occupancy">
                            <span class="occupancy-value">${cls.avg_attendance}/${cls.max_capacity}</span>
                            <span class="occupancy-percent">${cls.occupancy_rate}%</span>
                        </div>
                        <div class="occupancy-bar">
                            <div class="occupancy-fill" style="width: ${cls.occupancy_rate}%"></div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// ============ SALES PAGE ============
async function loadSalesData() {
    const sales = await apiCall('/api/analytics/sales', {
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate
    });

    if (!sales.success) return;
    const data = sales.data;

    // Summary
    document.getElementById('sales-summary').innerHTML = `
        <div class="sales-kpis">
            <div class="period-card">
                <h4>Total Ingresos</h4>
                <div class="period-value success">$${formatNumber(data.total_revenue)}</div>
            </div>
            <div class="period-card">
                <h4>Paquetes Vendidos</h4>
                <div class="period-value primary">${formatNumber(data.total_packages)}</div>
            </div>
            <div class="period-card">
                <h4>Ticket Promedio</h4>
                <div class="period-value warning">$${formatNumber(Math.round(data.total_revenue / (data.total_packages || 1)))}</div>
            </div>
        </div>
    `;

    // Package sales table
    document.getElementById('package-sales').innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Paquete</th>
                    <th>Vendidos</th>
                    <th>Ingresos</th>
                    <th>Créditos</th>
                </tr>
            </thead>
            <tbody>
                ${data.by_package_type.map(pkg => `
                    <tr>
                        <td>${pkg.name}</td>
                        <td>${pkg.count}</td>
                        <td>$${formatNumber(pkg.revenue)}</td>
                        <td>${pkg.credits}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Monthly sales table
    document.getElementById('monthly-sales').innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Mes</th>
                    <th>Paquetes</th>
                    <th>Ingresos</th>
                    <th>Créditos Vendidos</th>
                </tr>
            </thead>
            <tbody>
                ${data.by_month.map(month => `
                    <tr>
                        <td><strong>${month.month} ${month.year || ''}</strong></td>
                        <td>${month.count}</td>
                        <td>$${formatNumber(month.revenue)}</td>
                        <td>${month.credits}</td>
                    </tr>
                `).join('')}
                <tr class="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>${data.total_packages}</strong></td>
                    <td><strong>$${formatNumber(data.total_revenue)}</strong></td>
                    <td><strong>${data.by_month.reduce((sum, m) => sum + m.credits, 0)}</strong></td>
                </tr>
            </tbody>
        </table>
    `;
}

// ============ TOP BUYERS ============
async function loadTopBuyers() {
    const result = await apiCall('/api/analytics/top-buyers', {
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate,
        limit: 25
    });

    if (!result.success) return;

    const el = document.getElementById('top-buyers');
    el.innerHTML = result.data.map((buyer, i) => {
        let rankClass = 'other';
        if (i === 0) rankClass = 'gold';
        else if (i === 1) rankClass = 'silver';
        else if (i === 2) rankClass = 'bronze';

        // Escape quotes in name for onclick
        const escapedName = buyer.full_name.replace(/'/g, "\\'");

        return `
            <div class="buyer-card">
                <div class="buyer-rank ${rankClass}">${buyer.rank}</div>
                <div class="buyer-info buyer-clickable" onclick="showPurchaseHistory('${buyer.user_id}', '${escapedName}')">
                    <div class="buyer-name">${buyer.full_name}</div>
                    <div class="buyer-phone">📞 ${buyer.phone} | 🎯 ${buyer.favorite_package}</div>
                </div>
                <div class="buyer-stats">
                    <div class="buyer-total">$${formatNumber(buyer.total_spent)}</div>
                    <div class="buyer-purchases">${buyer.total_purchases} compras · ${buyer.total_credits} créditos</div>
                </div>
                <button class="btn btn-whatsapp" onclick="sendVIPWhatsApp('${buyer.phone}', '${escapedName}')">
                    💬 WhatsApp
                </button>
            </div>
        `;
    }).join('');
}

// VIP WhatsApp function
function sendVIPWhatsApp(phone, name) {
    const template = document.getElementById('vip-whatsapp-message').value;
    const message = template.replace(/{nombre}/g, name.split(' ')[0]);

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12) {
        // Already has country code
    } else if (cleanPhone.length === 10) {
        cleanPhone = '52' + cleanPhone;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// Make function global
window.sendVIPWhatsApp = sendVIPWhatsApp;

// ============ MODAL ============
function setupModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('purchase-modal').addEventListener('click', (e) => {
        if (e.target.id === 'purchase-modal') closeModal();
    });
}

function closeModal() {
    document.getElementById('purchase-modal').classList.remove('active');
}

async function showPurchaseHistory(userId, userName) {
    const modal = document.getElementById('purchase-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = `Historial de Compras - ${userName}`;
    body.innerHTML = '<p class="loading">Cargando historial...</p>';
    modal.classList.add('active');

    const result = await apiCall('/api/analytics/user-history', { userId });

    if (!result.success || result.data.length === 0) {
        body.innerHTML = '<p class="info-message">No hay compras registradas</p>';
        return;
    }

    body.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Paquete</th>
                    <th>Precio</th>
                    <th>Créditos</th>
                    <th>Restantes</th>
                </tr>
            </thead>
            <tbody>
                ${result.data.map(p => `
                    <tr>
                        <td>${new Date(p.date).toLocaleDateString('es-MX')}</td>
                        <td>${p.package_name}</td>
                        <td>$${formatNumber(p.price)}</td>
                        <td>${p.credits_total}</td>
                        <td>${p.credits_remaining}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="modal-summary">
            <strong>Total: ${result.data.length} compras · $${formatNumber(result.data.reduce((s, p) => s + p.price, 0))}</strong>
        </div>
    `;
}

// Make function global
window.showPurchaseHistory = showPurchaseHistory;

// ============ COMPARE ============
function setupCompare() {
    document.getElementById('run-compare').addEventListener('click', runCompare);
}

async function runCompare() {
    const period1Start = document.getElementById('period1-start').value;
    const period1End = document.getElementById('period1-end').value;
    const period2Start = document.getElementById('period2-start').value;
    const period2End = document.getElementById('period2-end').value;

    if (!period1Start || !period1End || !period2Start || !period2End) {
        showToast('Completa todas las fechas', 'error');
        return;
    }

    showToast('Comparando períodos...');

    // Get sales comparison
    const salesCompare = await apiCall('/api/analytics/compare', {
        period1Start, period1End, period2Start, period2End
    });

    // Get credits comparison
    const creditsCompare = await apiCall('/api/analytics/credits-compare', {
        period1Start, period1End, period2Start, period2End
    });

    if (salesCompare.success) updateCompareUI(salesCompare.data);
    if (creditsCompare.success) updateCreditsCompareUI(creditsCompare.data, period1Start, period1End, period2Start, period2End);

    showToast('Comparación completada', 'success');
}

function updateCompareUI(data) {
    const el = document.getElementById('compare-results');
    const diffColor = parseFloat(data.diff.revenue_pct) >= 0 ? 'positive' : 'negative';
    const diffIcon = parseFloat(data.diff.revenue_pct) >= 0 ? '📈' : '📉';

    el.innerHTML = `
        <div class="compare-card">
            <div class="period-card">
                <h4>📅 ${data.period1.range}</h4>
                <div class="period-value muted">$${formatNumber(data.period1.total_revenue)}</div>
                <small>${data.period1.total_packages} paquetes</small>
            </div>
            
            <div class="diff-card">
                <div class="diff-badge diff-${diffColor}">
                    ${diffIcon} ${data.diff.revenue_pct}%
                </div>
                <small class="muted">${parseFloat(data.diff.revenue) >= 0 ? '+' : ''}$${formatNumber(data.diff.revenue)}</small>
            </div>
            
            <div class="period-card">
                <h4>📅 ${data.period2.range}</h4>
                <div class="period-value success">$${formatNumber(data.period2.total_revenue)}</div>
                <small>${data.period2.total_packages} paquetes</small>
            </div>
        </div>
    `;
}

function updateCreditsCompareUI(data, p1s, p1e, p2s, p2e) {
    const el = document.getElementById('credits-compare');

    const creditsDiff = data.period2.credits_purchased - data.period1.credits_purchased;
    const usedDiff = data.period2.credits_used - data.period1.credits_used;

    el.innerHTML = `
        <div class="credits-grid">
            <div class="credits-card">
                <h4>🎫 Créditos Comprados</h4>
                <div class="credits-compare-row">
                    <div class="credits-period">
                        <span class="label">Período 1</span>
                        <span class="value">${formatNumber(data.period1.credits_purchased)}</span>
                    </div>
                    <div class="credits-diff ${creditsDiff >= 0 ? 'positive' : 'negative'}">
                        ${creditsDiff >= 0 ? '+' : ''}${formatNumber(creditsDiff)}
                    </div>
                    <div class="credits-period">
                        <span class="label">Período 2</span>
                        <span class="value">${formatNumber(data.period2.credits_purchased)}</span>
                    </div>
                </div>
            </div>
            
            <div class="credits-card">
                <h4>✅ Créditos Usados</h4>
                <div class="credits-compare-row">
                    <div class="credits-period">
                        <span class="label">Período 1</span>
                        <span class="value">${formatNumber(data.period1.credits_used)}</span>
                    </div>
                    <div class="credits-diff ${usedDiff >= 0 ? 'positive' : 'negative'}">
                        ${usedDiff >= 0 ? '+' : ''}${formatNumber(usedDiff)}
                    </div>
                    <div class="credits-period">
                        <span class="label">Período 2</span>
                        <span class="value">${formatNumber(data.period2.credits_used)}</span>
                    </div>
                </div>
            </div>
            
            <div class="credits-card highlight">
                <h4>🔄 Clientas Recurrentes</h4>
                <div class="recurring-stat">
                    <div class="recurring-value">${data.recurring_clients}</div>
                    <div class="recurring-label">clientas compraron en ambos períodos</div>
                    <div class="recurring-percent">${data.recurring_percentage}% de recurrencia</div>
                </div>
            </div>
        </div>
    `;
}

// ============ DORMANT ============
function setupDormant() {
    document.getElementById('load-dormant').addEventListener('click', () => {
        dormantPagination.page = 1;
        loadDormant();
    });
}

async function loadDormant(page = 1) {
    dormantPagination.page = page;
    const days = parseInt(document.getElementById('dormant-days').value);

    const result = await apiCall('/api/analytics/dormant-paginated', {
        daysInactive: days,
        page,
        pageSize: dormantPagination.pageSize
    });

    if (!result.success) return;

    const data = result.data;
    dormantPagination.totalPages = data.pagination.totalPages;

    // Summary
    document.getElementById('dormant-summary').innerHTML = `
        <div class="dormant-alert">
            <strong>⚠️ ${data.pagination.totalItems} clientas</strong> llevan más de ${days} días sin actividad
        </div>
    `;

    // List
    const el = document.getElementById('dormant-list');
    if (data.clients.length === 0) {
        el.innerHTML = '<p class="info-message">🎉 ¡Excelente! No hay clientas inactivas en esta página.</p>';
    } else {
        el.innerHTML = data.clients.map(client => `
            <div class="dormant-card">
                <div class="dormant-avatar">${client.full_name.charAt(0).toUpperCase()}</div>
                <div class="dormant-info">
                    <div class="dormant-name">${client.full_name}</div>
                    <div class="dormant-phone">📞 ${client.phone}</div>
                </div>
                <div class="dormant-days-badge">${client.days_inactive} días</div>
                <button class="btn btn-whatsapp" onclick="sendWhatsApp('${client.phone}', '${client.full_name}', ${client.days_inactive})">
                    💬 WhatsApp
                </button>
            </div>
        `).join('');
    }

    // Pagination
    renderPagination();
}

function renderPagination() {
    const el = document.getElementById('dormant-pagination');
    const { page, totalPages } = dormantPagination;

    if (totalPages <= 1) {
        el.innerHTML = '';
        return;
    }

    let buttons = '';

    // Previous
    buttons += `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="loadDormant(${page - 1})">← Anterior</button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
            buttons += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="loadDormant(${i})">${i}</button>`;
        } else if (i === page - 3 || i === page + 3) {
            buttons += '<span class="pagination-dots">...</span>';
        }
    }

    // Next
    buttons += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="loadDormant(${page + 1})">Siguiente →</button>`;

    el.innerHTML = buttons;
}

function sendWhatsApp(phone, name, days) {
    const template = document.getElementById('whatsapp-message').value;
    const message = template
        .replace(/{nombre}/g, name.split(' ')[0])
        .replace(/{dias}/g, days);

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12) {
        // Already has country code
    } else if (cleanPhone.length === 10) {
        cleanPhone = '52' + cleanPhone;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// Make functions global
window.loadDormant = loadDormant;
window.sendWhatsApp = sendWhatsApp;

// ============ REPORTS ============
async function loadReports() {
    const result = await apiGet('/api/reports');

    if (!result.success) return;

    const el = document.getElementById('reports-list');

    if (result.reports.length === 0) {
        el.innerHTML = '<p class="info-message">No hay reportes generados aún. Haz clic en "Generar PDF" para crear uno.</p>';
        return;
    }

    el.innerHTML = result.reports.map(report => `
        <div class="report-item">
            <div class="report-info">
                <span class="report-icon">📄</span>
                <div>
                    <div class="report-name">${report.filename}</div>
                    <div class="report-date">${new Date(report.createdAt).toLocaleString('es-MX')}</div>
                </div>
            </div>
            <a href="${report.downloadUrl}" target="_blank" class="btn-download">⬇️ Descargar</a>
        </div>
    `).join('');
}

// ============ GENERATE PDF ============
async function generatePDF() {
    showLoading(true);

    const result = await apiCall('/api/generate-pdf', {
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate
    });

    showLoading(false);

    if (result.success) {
        showToast('✅ PDF generado exitosamente', 'success');
        window.open(result.downloadUrl, '_blank');
        await loadReports();
        navigateToSection('reports');
    } else {
        showToast('❌ Error generando PDF: ' + result.error, 'error');
    }
}

// ============ UTILITIES ============
function formatNumber(num) {
    return new Intl.NumberFormat('es-MX').format(num || 0);
}

function showLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('active', show);
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
