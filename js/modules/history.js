// js/modules/history.js

import * as db from './db.js';
import { STORES } from './db.js';
import { printA4Report } from './printing.js';
import { formatDateWithEnglishNumerals, debounce, showToast } from '../utils.js';
import { requestPassword } from './ui.js';

let currentPage = 1;
const invoicesPerPage = 20;

export async function renderInvoicesHistory(page = 1) {
    currentPage = page;
    const tableBody = document.querySelector('#invoices-table tbody');
    const noInvoicesMessage = document.getElementById('no-invoices-message');
    if (!tableBody || !noInvoicesMessage) return;

    tableBody.innerHTML = '<tr><td colspan="5">جاري تحميل الفواتير...</td></tr>';
    
    const invoices = await db.getPaginatedInvoices(page, invoicesPerPage);
    
    if (invoices.length === 0 && page === 1) {
        tableBody.innerHTML = '';
        noInvoicesMessage.style.display = 'block';
        noInvoicesMessage.textContent = 'لا توجد أي فواتير مسجلة بعد.';
    } else {
        tableBody.innerHTML = invoices.map(inv => {
            const typeTranslations = { restaurant: 'مطعم', cafe: 'كافيه', football: 'ملعب', pos: 'نقاط بيع', booking: 'حجز', simple: 'خدمة' };
            const sectionName = inv.sectionName || typeTranslations[inv.type] || inv.type;
            return `
                <tr>
                    <td>${inv.id}</td>
                    <td>${sectionName}</td>
                    <td>${formatDateWithEnglishNumerals(inv.date)}</td>
                    <td>${inv.total.toFixed(2)} SDG</td>
                    <td><button class="delete-invoice-btn" data-invoice-id="${inv.id}" title="حذف الفاتورة">🗑️</button></td>
                </tr>
            `;
        }).join('');
        noInvoicesMessage.style.display = 'none';
    }
    updatePaginationControls();
}

async function updatePaginationControls() {
    const totalInvoices = await db.getInvoiceCount();
    const totalPages = Math.ceil(totalInvoices / invoicesPerPage) || 1;
    
    document.getElementById('page-info').textContent = `صفحة ${currentPage} من ${totalPages}`;
    document.getElementById('prev-page-btn').disabled = currentPage === 1;
    document.getElementById('next-page-btn').disabled = currentPage >= totalPages;
}

async function deleteInvoice(invoiceId) {
    requestPassword(async () => {
        await db.deleteItem(STORES.INVOICES, invoiceId);
        await renderInvoicesHistory(currentPage);
        showToast('تم حذف الفاتورة بنجاح.');
    });
}

async function generateReport(days) {
    const allInvoices = await db.getAll(STORES.INVOICES);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const filtered = allInvoices.filter(inv => new Date(inv.date) >= startDate && new Date(inv.date) <= endDate);
    const title = (days === 1) ? `تقرير اليوم: ${endDate.toLocaleDateString('ar-EG')}` : `تقرير آخر ${days} أيام`;
    printA4Report(filtered, title);
}

async function generateDateRangeReport() {
    const startDateInput = document.getElementById('report-start-date').value;
    const endDateInput = document.getElementById('report-end-date').value;
    if (!startDateInput || !endDateInput) return showToast('الرجاء تحديد تاريخ بداية ونهاية الفترة.', 'error');

    const startDate = new Date(startDateInput);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) return showToast('تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.', 'error');

    const allInvoices = await db.getAll(STORES.INVOICES);
    const filtered = allInvoices.filter(inv => new Date(inv.date) >= startDate && new Date(inv.date) <= endDate);
    const title = `تقرير الفترة من ${startDate.toLocaleDateString('ar-EG')} إلى ${endDate.toLocaleDateString('ar-EG')}`;
    printA4Report(filtered, title);
}

async function searchInvoices(searchTerm) {
    const tableBody = document.querySelector('#invoices-table tbody');
    const noInvoicesMessage = document.getElementById('no-invoices-message');
    
    if (!searchTerm) {
        noInvoicesMessage.style.display = 'none';
        document.getElementById('pagination-controls').style.display = 'flex';
        renderInvoicesHistory(1);
        return;
    }
    
    document.getElementById('pagination-controls').style.display = 'none';
    const invoiceId = parseInt(searchTerm, 10);
    if (isNaN(invoiceId)) {
        tableBody.innerHTML = '';
        noInvoicesMessage.textContent = 'الرجاء إدخال رقم فاتورة صحيح.';
        noInvoicesMessage.style.display = 'block';
        return;
    }

    const invoice = await db.get(STORES.INVOICES, invoiceId);
    if (invoice) {
        const typeTranslations = { restaurant: 'مطعم', cafe: 'كافيه', football: 'ملعب' };
        const sectionName = invoice.sectionName || typeTranslations[invoice.type] || invoice.type;
        tableBody.innerHTML = `
            <tr>
                <td>${invoice.id}</td>
                <td>${sectionName}</td>
                <td>${formatDateWithEnglishNumerals(invoice.date)}</td>
                <td>${invoice.total.toFixed(2)} SDG</td>
                <td><button class="delete-invoice-btn" data-invoice-id="${invoice.id}" title="حذف الفاتورة">🗑️</button></td>
            </tr>
        `;
        noInvoicesMessage.style.display = 'none';
    } else {
        tableBody.innerHTML = '';
        noInvoicesMessage.textContent = 'لا توجد فاتورة بهذا الرقم.';
        noInvoicesMessage.style.display = 'block';
    }
}

const debouncedSearch = debounce(searchInvoices, 350);

export function initHistory() {
    document.getElementById('invoice-search-input')?.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));
    document.querySelector('#invoices-table tbody')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-invoice-btn')) {
            deleteInvoice(parseInt(e.target.dataset.invoiceId, 10));
        }
    });
    document.getElementById('print-today-report')?.addEventListener('click', () => generateReport(1));
    document.getElementById('print-7days-report')?.addEventListener('click', () => generateReport(7));
    document.getElementById('print-30days-report')?.addEventListener('click', () => generateReport(30));
    document.getElementById('print-range-report')?.addEventListener('click', generateDateRangeReport);
    document.getElementById('next-page-btn')?.addEventListener('click', () => renderInvoicesHistory(currentPage + 1));
    document.getElementById('prev-page-btn')?.addEventListener('click', () => renderInvoicesHistory(currentPage - 1));
}