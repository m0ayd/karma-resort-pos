let db;
const DB_NAME = 'KarmaResortDB';
const DB_VERSION = 2; // [تم التعديل] زيادة رقم الإصدار لتطبيق التغييرات على قاعدة البيانات

export const STORES = {
    INVOICES: 'invoices',
    ITEMS: 'items',
    APP_STATE: 'appState'
};

const INVOICES_DATE_INDEX = 'date-index'; // [جديد] تعريف اسم الفهرس

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Error opening database');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;

            if (!dbInstance.objectStoreNames.contains(STORES.INVOICES)) {
                const invoiceStore = dbInstance.createObjectStore(STORES.INVOICES, { keyPath: 'id' });
                 // [جديد] إنشاء الفهرس على حقل التاريخ
                invoiceStore.createIndex(INVOICES_DATE_INDEX, 'date', { unique: false });
            } else {
                // [جديد] التأكد من إضافة الفهرس إذا كان المتجر موجوداً بالفعل
                 const transaction = event.target.transaction;
                 const invoiceStore = transaction.objectStore(STORES.INVOICES);
                 if (!invoiceStore.indexNames.contains(INVOICES_DATE_INDEX)) {
                    invoiceStore.createIndex(INVOICES_DATE_INDEX, 'date', { unique: false });
                 }
            }

            if (!dbInstance.objectStoreNames.contains(STORES.ITEMS)) {
                dbInstance.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains(STORES.APP_STATE)) {
                dbInstance.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
            }
        };
    });
}

// --- وظائف عامة ---
function getStore(storeName, mode = 'readonly') {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
}

// [جديد] دالة لحساب عدد الفواتير الإجمالي
export function getInvoiceCount() {
    return new Promise((resolve, reject) => {
        const store = getStore(STORES.INVOICES);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// [جديد] دالة لجلب الفواتير مع الترقيم
export function getPaginatedInvoices(page = 1, pageSize = 20) {
    return new Promise((resolve, reject) => {
        const store = getStore(STORES.INVOICES);
        const index = store.index(INVOICES_DATE_INDEX);
        const invoices = [];
        let skipped = false;
        const lowerBound = (page - 1) * pageSize;

        // نستخدم المؤشر (cursor) للتحرك بين السجلات بالترتيب العكسي (الأحدث أولاً)
        const request = index.openCursor(null, 'prev');

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                // تخطي السجلات حتى نصل إلى بداية الصفحة المطلوبة
                if (!skipped && lowerBound > 0) {
                    skipped = true;
                    cursor.advance(lowerBound);
                    return;
                }

                // إضافة السجلات إلى المصفوفة حتى نصل إلى حجم الصفحة
                if (invoices.length < pageSize) {
                    invoices.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(invoices);
                }
            } else {
                // وصلنا إلى نهاية السجلات
                resolve(invoices);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}


export function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function get(storeName, key) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function put(storeName, value, key) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = key ? store.put(value, key) : store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function add(storeName, value) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.add(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}


export function deleteItem(storeName, key) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

export function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}