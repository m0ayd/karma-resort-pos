// js/modules/pos.js

import * as db from './db.js';
import { STORES } from './db.js';
import { showToast } from '../utils.js';
import { printReceipt } from './printing.js';

let currentInvoices = {};
let cafeActiveCategory = 'coffee';

async function renderPosItems(sectionId) {
    const allItems = await db.getAll(STORES.ITEMS);
    
    if (sectionId === 'cafe') {
        renderCafeCategories();
        const grid = document.getElementById('cafe-items-grid');
        grid.innerHTML = '';
        const activeItems = allItems.filter(item => item.sectionId === 'cafe' && item.subCategory === cafeActiveCategory);
        if (activeItems.length === 0) {
            grid.innerHTML = `<p class="empty-invoice">لا توجد أصناف في هذه الفئة.</p>`;
        } else {
            activeItems.forEach(item => grid.appendChild(createItemCard(item, 'cafe')));
        }
    } else {
        const grid = document.getElementById(`${sectionId}-items-grid`);
        if (!grid) return;
        grid.innerHTML = '';
        const sectionItems = allItems.filter(item => item.sectionId === sectionId);
        if (sectionItems.length === 0) {
            grid.innerHTML = `<p class="empty-invoice">لم يتم إضافة أصناف لهذا القسم بعد.</p>`;
        } else {
            sectionItems.forEach(item => grid.appendChild(createItemCard(item, sectionId)));
        }
    }
}

function createItemCard(item, sectionId) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `<div class="item-name">${item.name}</div><div class="item-price">${item.price.toFixed(2)} SDG</div>`;
    card.addEventListener('click', () => addItemToInvoice(sectionId, item));
    return card;
}

function renderCafeCategories() {
    const container = document.getElementById('cafe-category-filters');
    container.innerHTML = '';
    const categories = { coffee: 'قهوة', juice: 'عصائر', tea: 'شاي ومشروبات ساخنة' };
    for (const [key, value] of Object.entries(categories)) {
        const btn = document.createElement('button');
        btn.className = `category-btn ${cafeActiveCategory === key ? 'active' : ''}`;
        btn.textContent = value;
        btn.addEventListener('click', () => {
            cafeActiveCategory = key;
            renderPosItems('cafe');
        });
        container.appendChild(btn);
    }
}

function addItemToInvoice(sectionId, item) {
    if (!currentInvoices[sectionId]) {
        currentInvoices[sectionId] = [];
    }
    const invoice = currentInvoices[sectionId];
    const existingItem = invoice.find(i => i.id === item.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        invoice.push({ ...item, quantity: 1 });
    }
    renderInvoice(sectionId);
}

function updateQuantity(sectionId, itemId, change) {
    const invoice = currentInvoices[sectionId];
    if (!invoice) return;
    const item = invoice.find(i => i.id === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            currentInvoices[sectionId] = invoice.filter(i => i.id !== itemId);
        }
    }
    renderInvoice(sectionId);
}

function clearInvoice(sectionId) {
    if (currentInvoices[sectionId]?.length > 0 && confirm('هل أنت متأكد من إفراغ الفاتورة الحالية؟')) {
        currentInvoices[sectionId] = [];
        renderInvoice(sectionId);
    }
}

function renderInvoice(sectionId) {
    const container = document.getElementById(`${sectionId}-invoice-items`);
    const totalEl = document.getElementById(`${sectionId}-total`);
    if (!container || !totalEl) return;
    
    const invoice = currentInvoices[sectionId] || [];
    if (invoice.length === 0) {
        container.innerHTML = `<p class="empty-invoice">لم يتم إضافة أي صنف بعد</p>`;
    } else {
        container.innerHTML = invoice.map(item => `
            <div class="invoice-item">
                <div class="name">${item.name}</div>
                <div class="price">${item.quantity} x ${item.price.toFixed(2)}</div>
                <div class="quantity-controls">
                    <button class="quantity-btn plus" data-id="${item.id}" data-section-id="${sectionId}">+</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn minus" data-id="${item.id}" data-section-id="${sectionId}">-</button>
                </div>
            </div>`).join('');
    }
    const total = invoice.reduce((sum, i) => sum + (i.quantity * i.price), 0);
    totalEl.textContent = `${total.toFixed(2)} SDG`;
}

async function handlePosPrint(sectionId) {
    const invoiceItems = currentInvoices[sectionId];
    if (!invoiceItems || invoiceItems.length === 0) {
        return showToast('لا يمكن إصدار فاتورة فارغة!', 'error');
    }
    
    const total = invoiceItems.reduce((sum, i) => sum + (i.quantity * i.price), 0);
    const customSections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    const sectionInfo = customSections.find(s => s.id === sectionId);

    const invoiceCounterState = await db.get(STORES.APP_STATE, 'invoiceCounter');
    const newId = (invoiceCounterState?.value || 0) + 1;
    const sectionName = sectionInfo?.name || (sectionId === 'restaurant' ? 'المطعم' : 'الكافيه');
    
    const newInvoice = {
        id: newId,
        type: 'pos',
        sectionName: sectionName,
        date: new Date().toISOString(),
        details: { items: invoiceItems },
        total: total
    };
    
    await db.add(STORES.INVOICES, newInvoice);
    await db.put(STORES.APP_STATE, { key: 'invoiceCounter', value: newId });

    showToast('تم إصدار الفاتورة بنجاح.');
    printReceipt(newInvoice);

    currentInvoices[sectionId] = [];
    renderInvoice(sectionId);
}

export function initPos(sectionId) {
    if (!currentInvoices[sectionId]) {
        currentInvoices[sectionId] = [];
    }
    renderPosItems(sectionId);
    renderInvoice(sectionId);
}

document.getElementById('main-content-area').addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button) return;

    if (button.matches('.print-button, .clear-button') && button.dataset.sectionId) {
        const { action, sectionId } = button.dataset;
        if (action === 'print') handlePosPrint(sectionId);
        else if (action === 'clear') clearInvoice(sectionId);
    }
    
    if (button.matches('.quantity-btn')) {
        const { sectionId, id } = button.dataset;
        const change = button.classList.contains('plus') ? 1 : -1;
        updateQuantity(sectionId, parseInt(id), change);
    }
});
 
document.addEventListener('itemsUpdated', (event) => {
     const { sectionId } = event.detail;
     const activePage = document.querySelector('.page.active');
     if (activePage && activePage.id === sectionId) {
         renderPosItems(sectionId);
     }
 });