import * as db from './db.js';
import { STORES } from './db.js';
import { showToast } from '../utils.js';
import { createSectionUI } from './ui.js';

let allItemsCache = [];

function initUpdaterUI() {
    const updateInfo = document.getElementById('update-info');
    const checkBtn = document.getElementById('check-update-btn');
    const installBtn = document.getElementById('install-update-btn');
    const progressContainer = document.getElementById('update-progress-container');
    const progressBar = document.getElementById('update-progress-bar');
    const progressText = document.getElementById('update-progress-text');

    checkBtn.addEventListener('click', () => {
        window.electronAPI.checkForUpdate();
    });
    
    installBtn.addEventListener('click', () => {
        window.electronAPI.startUpdate();
    });

    window.electronAPI.onUpdateStatus(({ status, info, error, progress }) => {
        checkBtn.style.display = 'inline-block';
        installBtn.style.display = 'none';
        progressContainer.style.display = 'none';

        switch (status) {
            case 'checking':
                updateInfo.innerHTML = `<p>يتم التحقق من وجود تحديثات...</p>`;
                break;
            case 'available':
                updateInfo.innerHTML = `<p>يوجد تحديث جديد! الإصدار <span class="version-info">${info.version}</span> متاح.</p>`;
                installBtn.innerText = 'تنزيل وتثبيت التحديث';
                installBtn.style.display = 'inline-block';
                checkBtn.style.display = 'none';
                break;
            case 'not-available':
                updateInfo.innerHTML = `<p>أنت تستخدم أحدث إصدار بالفعل.</p>`;
                break;
            case 'downloading':
                progressContainer.style.display = 'flex';
                const percent = Math.round(progress.percent);
                progressBar.style.width = `${percent}%`;
                progressText.innerText = `جاري التنزيل (${percent}%) - ${Math.round(progress.bytesPerSecond / 1024)} KB/s`;
                updateInfo.innerHTML = `<p>جاري تنزيل التحديث...</p>`;
                checkBtn.style.display = 'none';
                break;
            case 'downloaded':
                updateInfo.innerHTML = `<p>تم تنزيل التحديث بنجاح. سيتم التثبيت بعد إغلاق التطبيق.</p>`;
                installBtn.innerText = 'إعادة التشغيل والتثبيت الآن';
                installBtn.style.display = 'inline-block';
                checkBtn.style.display = 'none';
                break;
            case 'error':
                updateInfo.innerHTML = `<p>حدث خطأ أثناء التحديث.</p>`;
                showToast(`خطأ: ${error}`, 'error');
                break;
        }
    });
}

async function renderDynamicManagers() {
    allItemsCache = await db.getAll(STORES.ITEMS);
    const customSections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    const itemsContainer = document.getElementById('items-management-container');
    
    itemsContainer.querySelectorAll('.dynamic-manager').forEach(el => el.remove());

    customSections.forEach(section => {
        let managerCard = document.createElement('div');
        managerCard.className = 'setting-card dynamic-manager';
        if (section.template === 'pos') {
            managerCard.innerHTML = `<h4>أصناف ${section.name}</h4><div id="${section.id}-items-manager" class="items-list"></div><div class="add-item-form"><input type="text" id="new-${section.id}-item-name" placeholder="اسم الصنف الجديد" maxlength="50" autocomplete="off"><input type="number" id="new-${section.id}-item-price" placeholder="سعره" autocomplete="off"><button class="add-btn" data-section="${section.id}">إضافة صنف</button></div>`;
            itemsContainer.appendChild(managerCard);
            displayItemsForSection(section.id);
        } else if (section.template === 'booking') {
            managerCard.innerHTML = `<h4>إعدادات ${section.name}</h4><div class="setting-field"><label for="quick-price-${section.id}">المبلغ السريع:</label><input type="number" id="quick-price-${section.id}" class="dynamic-quick-price" data-section-id="${section.id}" value="${section.quickPrice || ''}" placeholder="مثال: 15000"></div>`;
            itemsContainer.appendChild(managerCard);
        }
    });
}

function displayItemsForSection(sectionId) {
    const container = document.getElementById(`${sectionId}-items-manager`);
    if (!container) return;
    const sectionItems = allItemsCache.filter(item => item.sectionId === sectionId);
    if (sectionItems.length === 0) {
        container.innerHTML = '<p class="empty-list">لا توجد أصناف.</p>';
    } else {
        container.innerHTML = sectionItems.sort((a,b) => a.id - b.id).map(item => `
            <div class="managed-item">
                <span>${item.name} - ${item.price ? item.price.toFixed(2) + ' SDG' : '----'}</span>
                <button class="remove-item-btn" data-id="${item.id}">&times;</button>
            </div>`).join('');
    }
}

async function addNewItem(sectionId) {
    const nameInput = document.getElementById(`new-${sectionId}-item-name`);
    const priceInput = document.getElementById(`new-${sectionId}-item-price`);
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);

    if (!name) return showToast('الرجاء إدخال اسم الصنف.', 'error');
    if (isNaN(price) || price < 0) return showToast('الرجاء إدخال سعر صحيح.', 'error');

    const newId = ((await db.get(STORES.APP_STATE, 'itemCounter'))?.value || 0) + 1;
    const newItem = { id: newId, name, price, sectionId, subCategory: sectionId === 'cafe' ? document.getElementById('new-cafe-item-category').value : null };
    await db.add(STORES.ITEMS, newItem);
    await db.put(STORES.APP_STATE, { key: 'itemCounter', value: newId });

    allItemsCache.push(newItem);
    displayItemsForSection(sectionId);
    nameInput.value = '';
    priceInput.value = '';
    showToast('تمت إضافة الصنف بنجاح.');
    document.dispatchEvent(new CustomEvent('itemsUpdated', { detail: { sectionId } }));
}

async function renderSectionsManager() {
    const sections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    const container = document.getElementById('custom-sections-list');
    if (sections.length === 0) {
        container.innerHTML = '<p class="empty-list">لم يتم إضافة أي قسم مخصص بعد.</p>';
    } else {
        container.innerHTML = sections.map(section => `
            <div class="managed-item">
                <span>${section.icon || '🔹'} ${section.name}</span>
                <button class="remove-section-btn" data-id="${section.id}">&times;</button>
            </div>`).join('');
    }
}

async function addSection(event) {
    event.preventDefault();
    const name = document.getElementById('new-section-name').value.trim();
    const icon = document.getElementById('new-section-icon').value.trim();
    const template = document.getElementById('new-section-template').value;
    if (!name || !template) return showToast('الرجاء إدخال اسم القسم واختيار القالب.', 'error');
    
    const newSection = { id: `custom_${Date.now()}`, name, icon, template };
    const sections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    sections.push(newSection);
    await db.put(STORES.APP_STATE, { key: 'customSections', value: sections });
    alert('تمت إضافة القسم بنجاح. سيتم إعادة تحميل الصفحة لتطبيق التغييرات.');
    window.location.reload();
}

async function removeSection(sectionId) {
    if (!confirm('هل أنت متأكد من حذف هذا القسم وكل الأصناف المرتبطة به؟')) return;
    let sections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    await db.put(STORES.APP_STATE, { key: 'customSections', value: sections.filter(s => s.id !== sectionId) });
    const itemsToDelete = allItemsCache.filter(item => item.sectionId === sectionId);
    for (const item of itemsToDelete) {
        await db.deleteItem(STORES.ITEMS, item.id);
    }
    alert('تم حذف القسم بنجاح. سيتم إعادة تحميل الصفحة.');
    window.location.reload();
}

export async function renderAllSettings() {
    const cashierInfo = (await db.get(STORES.APP_STATE, 'cashierInfo'))?.value || {};
    document.getElementById('cashier-name').value = cashierInfo.name || '';
    document.getElementById('cashier-phone').value = cashierInfo.phone || '';
    document.getElementById('quick-price-input').value = (await db.get(STORES.APP_STATE, 'quickPrice'))?.value || '';
    document.getElementById('screen-lock-timeout').value = (await db.get(STORES.APP_STATE, 'screenLockTimeout'))?.value ?? '';
    await renderSectionsManager();
    await renderDynamicManagers();
    displayItemsForSection('restaurant');
    displayItemsForSection('cafe');
}

export function initSettings() {
    initUpdaterUI();
    const container = document.getElementById('items-management-container');
    container?.addEventListener('click', e => {
        if (e.target.classList.contains('add-btn')) addNewItem(e.target.dataset.section);
        if (e.target.classList.contains('remove-item-btn') && confirm('هل أنت متأكد؟')) {
            db.deleteItem(STORES.ITEMS, parseInt(e.target.dataset.id)).then(renderAllSettings);
        }
    });
    container?.addEventListener('change', async e => {
        if (e.target.classList.contains('dynamic-quick-price')) {
            const { sectionId } = e.target.dataset;
            const newPrice = parseFloat(e.target.value) || 0;
            const sections = (await db.get(STORES.APP_STATE, 'customSections')).value || [];
            const section = sections.find(s => s.id === sectionId);
            if (section) {
                section.quickPrice = newPrice;
                await db.put(STORES.APP_STATE, { key: 'customSections', value: sections });
                showToast('تم تحديث المبلغ السريع.');
            }
        }
    });
    
    document.getElementById('custom-sections-list')?.addEventListener('click', e => {
        if (e.target.classList.contains('remove-section-btn')) removeSection(e.target.dataset.id);
    });
    document.getElementById('add-section-form')?.addEventListener('submit', addSection);
    
    document.getElementById('cashier-name').addEventListener('change', async (e) => db.put(STORES.APP_STATE, { key: 'cashierInfo', value: { ...(await db.get(STORES.APP_STATE, 'cashierInfo'))?.value, name: e.target.value } }));
    document.getElementById('cashier-phone').addEventListener('change', async (e) => db.put(STORES.APP_STATE, { key: 'cashierInfo', value: { ...(await db.get(STORES.APP_STATE, 'cashierInfo'))?.value, phone: e.target.value } }));
    document.getElementById('quick-price-input').addEventListener('change', async (e) => db.put(STORES.APP_STATE, { key: 'quickPrice', value: parseFloat(e.target.value) || 0 }));
    
    document.getElementById('password-change-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const passInput = document.getElementById('admin-password');
        if (passInput.value && passInput.value.length >= 4) {
            await db.put(STORES.APP_STATE, { key: 'adminPassword', value: passInput.value });
            showToast('تم تحديث كلمة المرور بنجاح.');
            passInput.value = '';
        } else if (passInput.value) {
            showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل.', 'error');
        }
    });

    document.getElementById('screen-lock-timeout').addEventListener('change', async (e) => {
        const timeout = parseInt(e.target.value, 10);
        if (!isNaN(timeout) && timeout >= 0) {
            await db.put(STORES.APP_STATE, { key: 'screenLockTimeout', value: timeout });
            showToast('تم تحديث مدة قفل الشاشة.');
            document.dispatchEvent(new CustomEvent('screenLockTimeoutChanged'));
        }
    });
    document.getElementById('cashier-password').addEventListener('change', async (e) => {
        if (e.target.value && e.target.value.length >= 4) {
            await db.put(STORES.APP_STATE, { key: 'cashierPassword', value: e.target.value });
            showToast('تم تحديث كلمة مرور الكاشير.');
            e.target.value = '';
        } else if (e.target.value) {
            showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل.', 'error');
        }
    });
}