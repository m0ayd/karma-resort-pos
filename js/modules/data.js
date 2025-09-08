import * as db from './db.js';
import { STORES } from './db.js';

// --- الحالة الأولية والبيانات التجريبية ---
const INITIAL_APP_STATE = [
    { key: 'seeded', value: false },
    { key: 'invoiceCounter', value: 0 },
    { key: 'itemCounter', value: 0 },
    { key: 'cashierInfo', value: { name: 'كاشير افتراضي', phone: '0123456789' } },
    { key: 'quickPrice', value: 20000 },
    { key: 'adminPassword', value: '1234' }, // كلمة المرور الافتراضية
    { key: 'customSections', value: [] } // [جديد] مصفوفة لتخزين الأقسام المخصصة
];

// --- وظيفة إضافة البيانات الأولية ---
export async function seedInitialData() {
    const isSeeded = await db.get(STORES.APP_STATE, 'seeded');
    if (isSeeded && isSeeded.value) {
        console.log('Data already seeded.');
        return;
    }

    console.log('Seeding initial data...');

    // 1. إضافة حالة التطبيق الأولية
    for (const item of INITIAL_APP_STATE) {
        await db.put(STORES.APP_STATE, item);
    }
    let itemCounter = 0;
    let invoiceCounter = 0;

    // 2. إضافة أصناف المطعم
    const restaurantItems = ['شاورما دجاج', 'كبسة لحم', 'برياني', 'فول', 'طعمية', 'مشويات مشكلة', 'بيتزا مارغريتا', 'باستا', 'كباب', 'فتة'];
    for (const name of restaurantItems) {
        const item = {
            id: ++itemCounter,
            name,
            price: parseFloat((Math.random() * 4500 + 500).toFixed(0)),
            sectionId: 'restaurant'
        };
        await db.add(STORES.ITEMS, item);
    }

    // 3. إضافة أصناف الكافيه
    const cafeItemsSeed = [
      { name: 'قهوة عادية', price: 1500, subCategory: 'coffee' },
      { name: 'نسكافي', price: 1500, subCategory: 'coffee' },
      { name: 'شاي لبن', price: 1500, subCategory: 'coffee' },
      { name: 'كاكاو', price: 1500, subCategory: 'coffee' },
      { name: 'سحلب', price: 1500, subCategory: 'coffee' },
      { name: 'شاي عادي', price: 1000, subCategory: 'tea' },
      { name: 'شيريا', price: 1000, subCategory: 'tea' },
      { name: 'قرفه', price: 1000, subCategory: 'tea' },
      { name: 'قرنفل', price: 1000, subCategory: 'tea' },
      { name: 'جنزبيل', price: 1000, subCategory: 'tea' },
      { name: 'فراولة مقاس كبير', price: 6000, subCategory: 'juice' },
      { name: 'فراولة مقاس صغير', price: 5000, subCategory: 'juice' },
      { name: 'عصير الليمون', price: 3000, subCategory: 'juice' },
      { name: 'عصير البرتقال', price: 3000, subCategory: 'juice' },
      { name: 'عصير مشكل', price: 4000, subCategory: 'juice' }
    ];

    for (const itemData of cafeItemsSeed) {
         const item = {
            id: ++itemCounter,
            name: itemData.name,
            price: itemData.price,
            sectionId: 'cafe',
            subCategory: itemData.subCategory
        };
        await db.add(STORES.ITEMS, item);
    }
    
    // (لم يعد يُنشئ فواتير اختبارية عند التهيئة)
    // تحديث عدادات الحالة النهائية
    await db.put(STORES.APP_STATE, { key: 'itemCounter', value: itemCounter });
    await db.put(STORES.APP_STATE, { key: 'invoiceCounter', value: invoiceCounter });
    await db.put(STORES.APP_STATE, { key: 'seeded', value: true });

    console.log('Initial data and fake invoices seeded successfully.');
}

// --- [جديد] دالة جديدة لتجميع بيانات النسخ الاحتياطي ---
export async function getBackupDataAsObject() {
    const invoices = await db.getAll(STORES.INVOICES);
    const items = await db.getAll(STORES.ITEMS);
    const appState = await db.getAll(STORES.APP_STATE);

    return {
        [STORES.INVOICES]: invoices,
        [STORES.ITEMS]: items,
        [STORES.APP_STATE]: appState,
    };
}

// --- وظائف استيراد وتصدير البيانات ---
export async function exportData() {
    try {
        const dataToExport = await getBackupDataAsObject(); // استخدام الدالة الجديدة

        const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', `karma_backup_${new Date().toISOString().split('T')[0]}.json`);
        link.click();
    } catch (error) {
        console.error("Export failed:", error);
        alert("فشل تصدير البيانات.");
    }
}

export async function importData(file) {
     if (!file) return;
     const reader = new FileReader();
     reader.onload = async (event) => {
         try {
            const importedData = JSON.parse(event.target.result);
            if (confirm('سيتم الآن دمج البيانات من الملف مع البيانات الحالية.\nهل تريد المتابعة؟')) {
                
                const existingInvoices = await db.getAll(STORES.INVOICES);
                const existingInvoiceIds = new Set(existingInvoices.map(inv => inv.id));
                const newInvoices = importedData[STORES.INVOICES] || [];
                for (const invoice of newInvoices) {
                    if (!existingInvoiceIds.has(invoice.id)) {
                        await db.put(STORES.INVOICES, invoice);
                    }
                }

                const existingItems = await db.getAll(STORES.ITEMS);
                const existingItemIds = new Set(existingItems.map(item => item.id));
                const newItems = importedData[STORES.ITEMS] || [];
                for (const item of newItems) {
                    if (!existingItemIds.has(item.id)) {
                        await db.put(STORES.ITEMS, item);
                    }
                }

                const newAppState = importedData[STORES.APP_STATE] || [];
                for (const setting of newAppState) {
                    if (setting.key === 'invoiceCounter' || setting.key === 'itemCounter') {
                        const currentCounter = await db.get(STORES.APP_STATE, setting.key);
                        if (currentCounter && currentCounter.value > setting.value) {
                        } else {
                            await db.put(STORES.APP_STATE, setting);
                        }
                    } else {
                        await db.put(STORES.APP_STATE, setting);
                    }
                }

                alert("تم دمج البيانات بنجاح. سيتم إعادة تحميل الصفحة الآن.");
                setTimeout(() => window.location.reload(), 1500);
            }
         } catch (error) {
             console.error("Import failed:", error);
             alert("فشل الاستيراد. الملف قد يكون تالفًا أو بصيغة غير صحيحة.");
         }
     };
     reader.readAsText(file);
}

export async function deleteAllData() {
    if (confirm('⚠️ انتبه! هل أنت متأكد من حذف جميع الفواتير والبيانات؟ هذا الإجراء سيعيد النظام إلى حالة المصنع.')) {
        await db.clearStore(STORES.INVOICES);
        await db.clearStore(STORES.ITEMS);
        await db.clearStore(STORES.APP_STATE);
        alert("تم حذف جميع البيانات بنجاح. سيتم إعادة تحميل الصفحة.");
        window.location.reload();
    }
}