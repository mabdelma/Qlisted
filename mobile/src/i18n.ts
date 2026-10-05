/**
 * Strings for the app's NATIVE chrome only.
 *
 * Everything inside the WebViews (menu, ordering, orders) is the web app and
 * localises itself — it reads the WebView's navigator.language, so the device
 * language already reaches it. This file covers the small amount of UI that
 * lives outside the WebView and was therefore stuck in English: the tab bar,
 * the offline banner, and the account screen's connection state.
 *
 * Kept to the same eleven locales the web interface ships, with the same base
 * subtag matching, so the native shell and the embedded app agree. These are
 * the interface languages — what a guest can WRITE in an order note is not
 * limited to this list.
 *
 * Deliberately no new dependency. expo-localization would be the idiomatic
 * choice but adding a native module means a rebuild; `Intl` is available in
 * Hermes and degrades to English in a try/catch if it is not.
 */

export type MobileLocale =
  | 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ru' | 'ja' | 'it';

type Key = 'tabMenu' | 'tabOrders' | 'tabScan' | 'tabAccount' | 'offline' | 'pending' | 'online';

const STRINGS: Record<MobileLocale, Record<Key, string>> = {
  en: { tabMenu: 'Menu', tabOrders: 'Orders', tabScan: 'Scan', tabAccount: 'Account', offline: 'No internet connection', pending: 'pending', online: 'Online' },
  es: { tabMenu: 'Carta', tabOrders: 'Pedidos', tabScan: 'Escanear', tabAccount: 'Cuenta', offline: 'Sin conexión a internet', pending: 'pendientes', online: 'En línea' },
  fr: { tabMenu: 'Carte', tabOrders: 'Commandes', tabScan: 'Scanner', tabAccount: 'Compte', offline: 'Pas de connexion internet', pending: 'en attente', online: 'En ligne' },
  de: { tabMenu: 'Karte', tabOrders: 'Bestellungen', tabScan: 'Scannen', tabAccount: 'Konto', offline: 'Keine Internetverbindung', pending: 'ausstehend', online: 'Online' },
  pt: { tabMenu: 'Ementa', tabOrders: 'Pedidos', tabScan: 'Digitalizar', tabAccount: 'Conta', offline: 'Sem ligação à internet', pending: 'pendentes', online: 'Online' },
  it: { tabMenu: 'Menu', tabOrders: 'Ordini', tabScan: 'Scansiona', tabAccount: 'Account', offline: 'Nessuna connessione internet', pending: 'in attesa', online: 'Online' },
  ar: { tabMenu: 'القائمة', tabOrders: 'الطلبات', tabScan: 'مسح', tabAccount: 'الحساب', offline: 'لا يوجد اتصال بالإنترنت', pending: 'قيد الانتظار', online: 'متصل' },
  zh: { tabMenu: '菜单', tabOrders: '订单', tabScan: '扫码', tabAccount: '账户', offline: '无网络连接', pending: '待同步', online: '在线' },
  ja: { tabMenu: 'メニュー', tabOrders: '注文', tabScan: 'スキャン', tabAccount: 'アカウント', offline: 'インターネット接続がありません', pending: '保留中', online: 'オンライン' },
  ru: { tabMenu: 'Меню', tabOrders: 'Заказы', tabScan: 'Сканировать', tabAccount: 'Аккаунт', offline: 'Нет подключения к интернету', pending: 'в очереди', online: 'В сети' },
  hi: { tabMenu: 'मेन्यू', tabOrders: 'ऑर्डर', tabScan: 'स्कैन', tabAccount: 'खाता', offline: 'इंटरनेट कनेक्शन नहीं है', pending: 'बाकी', online: 'ऑनलाइन' },
};

function detectLocale(): MobileLocale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    // Match on the base subtag so pt-BR lands on Portuguese and zh-Hant on
    // Chinese, rather than silently falling back to English.
    const base = tag.toLowerCase().split('-')[0];
    if (base in STRINGS) return base as MobileLocale;
  } catch {
    /* no Intl in this runtime — English is the honest fallback */
  }
  return 'en';
}

export const locale: MobileLocale = detectLocale();
export const isRtl = locale === 'ar';

export function t(key: Key): string {
  return STRINGS[locale][key] ?? STRINGS.en[key];
}
