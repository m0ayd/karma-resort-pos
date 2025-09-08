// js/modules/printing.js

import { get } from './db.js';
import { STORES } from './db.js';
import { formatDateWithEnglishNumerals, showToast } from '../utils.js';

function printContent(content, printStyle) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;

    iframe.onload = function() {
        iframe.contentWindow.requestAnimationFrame(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                console.error("Printing failed:", e);
                showToast("فشلت عملية الطباعة.", "error");
            } finally {
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }
        });
    };

    doc.open();
    // --- بداية الحل للمشكلة الأولى ---
    // تم حذف سطر استيراد الخط من الإنترنت من هنا
    // الآن يتم حقن الـ CSS مباشرة بدون أي محاولة اتصال بالشبكة
    doc.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8"><title>Print</title>
            <style>
                /* لا يوجد استيراد لخطوط خارجية هنا لضمان السرعة في وضع عدم الاتصال */
                ${printStyle}
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    // --- نهاية الحل للمشكلة الأولى ---
    doc.close();
}


export async function printReceipt(invoice) {
    const cashierInfo = (await get(STORES.APP_STATE, 'cashierInfo'))?.value || {};
    const formattedDate = formatDateWithEnglishNumerals(invoice.date);

    let itemsHtml = '';
    
    if (invoice.type === 'pos' && invoice.details.items) {
        itemsHtml = `<table class="items-table-print">
            <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>
            <tbody>
                ${invoice.details.items.map(i => `
                    <tr>
                        <td>${i.name}</td>
                        <td class="center-align">${new Intl.NumberFormat('en-US').format(i.quantity)}</td>
                        <td class="left-align">${i.price ? new Intl.NumberFormat('en-US', {minimumFractionDigits: 2}).format(i.price) : '--'}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
    } else if (invoice.type === 'simple') {
        itemsHtml = `<div class="receipt-details"><p><b>الخدمة:</b> ${invoice.details.serviceName}</p></div>`;
    } else if (invoice.type === 'booking' || invoice.type === 'football') {
        itemsHtml = `<div class="receipt-details">
            ${invoice.details.customerName ? `<p><b>العميل:</b> ${invoice.details.customerName}</p>` : ''}
            <p><b>الوقت:</b> ${invoice.details.timeDisplay || 'غير محدد'}</p>
        </div>`;
    }

    const receiptContent = `
        <div class="receipt-header">
            <h3>منتجع كرمه العائلي</h3>
            <p>${invoice.sectionName || ''}</p>
            <p>فاتورة رقم: ${new Intl.NumberFormat('en-US').format(invoice.id)}</p>
        </div>
        <div class="receipt-info">
            <p>التاريخ: ${formattedDate}</p>
            ${cashierInfo.name ? `<p>الكاشير: ${cashierInfo.name} / ${cashierInfo.phone || ''}</p>` : ''}
        </div>
        <div class="receipt-separator"></div>
        ${itemsHtml}
        <div class="receipt-separator"></div>
        <div class="receipt-total-section">
            <p>الإجمالي: ${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2}).format(invoice.total)} SDG</p>
        </div>
        <div class="receipt-footer"><p>شكراً لزيارتكم!</p></div>
    `;

    const receiptStyle = `@page { size: 58mm; margin: 1mm; } body { font-family: 'Courier New', monospace; font-size: 9.5pt; line-height: 1.35; color: #000; text-align: center; direction: rtl; margin: 0; padding: 0; -webkit-print-color-adjust: exact; } h3 { font-size: 12pt; font-weight: bold; margin: 1px 0 3px 0; } p { margin: 1px 0; } .receipt-info { font-size: 8.5pt; text-align: right; margin-bottom: 3px; } .receipt-separator { border-top: 1px dashed #000; margin: 3px 0; } .items-table-print { width: 100%; border-collapse: collapse; text-align: right; font-size: 9pt; } .items-table-print th, .items-table-print td { padding: 2px 1px; word-break: break-all; } .items-table-print th { font-weight: bold; } .items-table-print .center-align { text-align: center; } .items-table-print .left-align { text-align: left; } .receipt-total-section { margin-top: 4px; } .receipt-total-section p { font-weight: bold; font-size: 11pt; text-align: left; margin: 2px 0; } .receipt-footer { margin-top: 5px; font-size: 8pt; }`;

    printContent(receiptContent, receiptStyle);
}

export function printA4Report(invoicesToPrint, title) {
    if (!invoicesToPrint || invoicesToPrint.length === 0) {
        return showToast('لا توجد فواتير في الفترة المحددة لطباعة التقرير.', 'error');
    }

    const totalSum = invoicesToPrint.reduce((sum, inv) => sum + inv.total, 0);
    const sortedInvoices = [...invoicesToPrint].sort((a, b) => new Date(a.date) - new Date(b.date));
    let tableRows = '';
    let lastDate = null;
    sortedInvoices.forEach(inv => {
        const currentDate = new Date(inv.date).toLocaleDateString('en-GB', { numberingSystem: 'latn' });
        if (currentDate !== lastDate) {
            tableRows += `<tr class="day-separator"><td colspan="4">--- ${currentDate} ---</td></tr>`;
            lastDate = currentDate;
        }
        const description = inv.details.customerName ? `${inv.type === 'football' ? inv.details.fieldName : 'مطعم/كافيه'} (${inv.details.customerName})` : (inv.type === 'football' ? inv.details.fieldName : 'مطعم/كافيه');
        tableRows += `<tr><td>${new Intl.NumberFormat('en-US').format(inv.id)}</td><td>${formatDateWithEnglishNumerals(inv.date)}</td><td>${description}</td><td>${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2}).format(inv.total)}</td></tr>`;
    });

    const reportContent = `
        <div class="print-header">
            <div class="logo-part"><h1>منتجع كرمه العائلي</h1><p>تقرير مالي</p></div>
            <div class="details-part"><p><strong>تاريخ الطباعة:</strong> ${formatDateWithEnglishNumerals(new Date())}</p><p><strong>عدد الفواتير:</strong> ${new Intl.NumberFormat('en-US').format(invoicesToPrint.length)}</p></div>
        </div>
        <h1 class="report-main-title">تقرير الفواتير</h1>
        <p class="report-date">${title}</p>
        <table class="report-table">
            <thead><tr><th>رقم الفاتورة</th><th>التاريخ والوقت</th><th>القسم/التفصيل</th><th>الإجمالي (SDG)</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="report-summary"><p>المجموع الكلي: ${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2}).format(totalSum)} SDG</p></div>
    `;

    const reportStyle = `@page { size: A4; margin: 20mm; } body { font-family: 'Tajawal', sans-serif; color: #000; direction: rtl; } .print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; } .print-header h1 { font-size: 18pt; margin: 0; } .print-header p { margin: 5px 0 0; font-size: 10pt; } .report-main-title { text-align: center; font-size: 22pt; margin-bottom: 10px; } .report-date { text-align: center; font-size: 12pt; margin-bottom: 30px; } .report-table { width: 100%; border-collapse: collapse; font-size: 11pt; } .report-table thead { display: table-header-group; } .report-table tr { page-break-inside: avoid; } .report-table th, .report-table td { border: 1px solid #333; padding: 10px; text-align: right; } .report-table th { background-color: #e0e0e0; font-weight: bold; } .report-table .day-separator td { background-color: #f0f0e0; font-weight: bold; text-align: center; border-top: 2px solid #333; border-bottom: 2px solid #333; } .report-summary { margin-top: 30px; padding-top: 15px; border-top: 2px solid #000; text-align: right; font-weight: bold; font-size: 14pt; }`;
    
    printContent(reportContent, reportStyle);
}