import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Locale = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ru' | 'ja' | 'it';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch',
  pt: 'Português', zh: '中文', hi: 'हिन्दी', ru: 'Русский', ja: '日本語', it: 'Italiano',
};

const RTL_LOCALES: Set<Locale> = new Set(['ar']);

export type TranslationKey =
  | 'app.name'
  | 'nav.home' | 'nav.menu' | 'nav.cart' | 'nav.orders' | 'nav.checkout' | 'nav.bill'
  | 'nav.signin' | 'nav.signup' | 'nav.signout' | 'nav.profile' | 'nav.admin' | 'nav.staff'
  | 'nav.pricing' | 'nav.features' | 'nav.contact' | 'nav.demo' | 'nav.kitchen'
  | 'nav.dashboard' | 'nav.reports' | 'nav.marketing' | 'nav.customers' | 'nav.inventory' | 'nav.modifiers' | 'nav.assistant'
  | 'nav.subscription' | 'nav.branding' | 'nav.analytics'
  | 'analytics.insights' | 'analytics.exports'
  | 'nav.viewStorefront' | 'nav.viewStorefrontHint' | 'nav.paymentLinks'
  | 'auth.email' | 'auth.password' | 'auth.signin' | 'auth.signup' | 'auth.name'
  | 'auth.confirmPassword' | 'auth.forgotPassword' | 'auth.resetPassword' | 'auth.newPassword'
  | 'auth.sendResetLink' | 'auth.resetYourPassword' | 'auth.troubleSigningIn'
  | 'auth.backToSignIn' | 'auth.or' | 'auth.noAccount' | 'auth.haveAccount'
  | 'auth.checkEmail' | 'auth.resetSent' | 'auth.passwordResetSuccess'
  | 'auth.invalidToken' | 'auth.tokenExpired' | 'auth.createAccount'
  | 'auth.accountCreated' | 'auth.verificationSent' | 'auth.resendEmail'
  | 'auth.changePassword' | 'auth.currentPassword'
  | 'common.loading' | 'common.error' | 'common.save' | 'common.cancel'
  | 'common.delete' | 'common.edit' | 'common.search' | 'common.back'
  | 'common.submit' | 'common.confirm' | 'common.total' | 'common.quantity'
  | 'common.price' | 'common.notes' | 'common.status' | 'common.date'
  | 'common.actions' | 'common.yes' | 'common.no' | 'common.close'
  | 'common.offline' | 'common.offlineMessage' | 'common.retry'
  | 'common.print' | 'common.receipt' | 'common.item' | 'common.items'
  | 'common.subtotal' | 'common.tax' | 'common.discount' | 'common.name'
  | 'common.description' | 'common.phone' | 'common.address' | 'common.create'
  | 'common.update' | 'common.remove' | 'common.continue' | 'common.done'
  | 'common.notAvailable' | 'common.confirmDelete' | 'common.noResults'
  | 'common.minutes' | 'common.hours' | 'common.settings' | 'common.viewAll'
  | 'order.pending' | 'order.preparing' | 'order.ready' | 'order.delivered'
  | 'order.cancelled' | 'order.newOrder' | 'order.orderReady' | 'order.orderHistory'
  | 'order.processOrder' | 'order.clearCart' | 'order.emptyCart' | 'order.addNotes'
  | 'order.required'
  | 'order.placedAt' | 'order.itemCount' | 'order.specialInstructions'
  | 'order.dineIn' | 'order.takeaway' | 'order.delivery' | 'order.allOrders'
  | 'order.activeOrders' | 'order.pastOrders'
  | 'table.available' | 'table.occupied' | 'table.reserved' | 'table.closed'
  | 'table.tableNumber' | 'table.changeStatus' | 'table.orderCount'
  | 'table.totalSpent' | 'table.noTable' | 'table.selectTable'
  | 'menu.categories' | 'menu.items' | 'menu.addToCart' | 'menu.noImage'
  | 'menu.search' | 'menu.description' | 'menu.options' | 'menu.soldOut'
  | 'menu.categoryAll' | 'menu.quantity' | 'menu.specialInstructions'
  | 'menu.chooseOne' | 'menu.chooseAny'
  | 'menu.allergenInfo' | 'menu.availableItems'
  | 'payment.pay' | 'payment.paid' | 'payment.unpaid' | 'payment.refunded'
  | 'payment.cash' | 'payment.card' | 'payment.wallet' | 'payment.tip'
  | 'payment.receipt' | 'payment.bill' | 'payment.split' | 'payment.paymentMethod'
  | 'payment.amount' | 'payment.change' | 'payment.totalDue' | 'payment.remainingBalance'
  | 'payment.payFull' | 'payment.payPartial' | 'payment.printReceipt'
  | 'payment.transactionId' | 'payment.payNow' | 'payment.orderSummary'
  | 'payment.roundUp' | 'payment.splitEven' | 'payment.splitByItem'
  | 'payment.numberOfPeople' | 'payment.tapYourItems' | 'payment.yourShare'
  | 'payment.payShare' | 'payment.alreadyPaid' | 'payment.balanceDue' | 'payment.cardOneOrder'
  | 'staff.kitchen' | 'staff.waiter' | 'staff.cashier' | 'staff.manager' | 'staff.admin'
  | 'nav.promotions' | 'nav.loyalty'
  | 'staff.tables' | 'staff.orders' | 'staff.pos' | 'staff.payments'
  | 'staff.history' | 'staff.activeOrders' | 'staff.orderHistory'
  | 'staff.profileSettings' | 'staff.signOut' | 'staff.waiterPanel'
  | 'staff.kitchenDisplay' | 'staff.cashierPanel'
  | 'settings.darkMode' | 'settings.language' | 'settings.theme'
  | 'settings.light' | 'settings.dark' | 'settings.system'
  | 'settings.profile' | 'settings.notifications' | 'settings.about' | 'settings.version'
  | 'cta.startTrial' | 'cta.learnMore' | 'cta.getStarted' | 'cta.contactUs'
  | 'cta.bookDemo' | 'cta.subscribe' | 'cta.tryForFree' | 'cta.requestDemo'
  | 'cta.signIn' | 'cta.signUp'
  | 'promo.title' | 'promo.create' | 'promo.edit' | 'promo.name' | 'promo.type'
  | 'promo.value' | 'promo.percentage' | 'promo.fixed' | 'promo.buyXGetY' | 'promo.happyHour'
  | 'promo.minOrder' | 'promo.maxDiscount' | 'promo.startDate' | 'promo.endDate'
  | 'promo.daysOfWeek' | 'promo.timeStart' | 'promo.timeEnd' | 'promo.usageLimit'
  | 'promo.usageCount' | 'promo.isActive' | 'promo.noCampaigns' | 'promo.enterCode'
  | 'promo.apply' | 'promo.applied' | 'promo.invalid' | 'promo.expired' | 'promo.reachedLimit'
  | 'loyalty.title' | 'loyalty.points' | 'loyalty.availablePoints' | 'loyalty.lifetime'
  | 'loyalty.tier' | 'loyalty.bronze' | 'loyalty.silver' | 'loyalty.gold' | 'loyalty.platinum'
  | 'loyalty.rewards' | 'loyalty.redeem' | 'loyalty.transactions' | 'loyalty.earn'
  | 'loyalty.welcome' | 'loyalty.noRewards' | 'loyalty.noTransactions' | 'loyalty.refresh'
  | 'footer.privacy' | 'footer.terms' | 'footer.copyright'
  | 'footer.company' | 'footer.support' | 'footer.legal'
  | 'marketing.trustedBy'
  | 'marketing.heroTitle' | 'marketing.heroDesc'
  | 'marketing.noCreditCard' | 'marketing.seeFeatures'
  | 'marketing.featuresTitle' | 'marketing.featuresDesc'
  | 'marketing.howItWorksTitle' | 'marketing.howItWorksDesc' | 'marketing.stepLabel'
  | 'marketing.showcaseTitle' | 'marketing.showcaseDesc'
  | 'marketing.showcaseItem1' | 'marketing.showcaseItem2' | 'marketing.showcaseItem3' | 'marketing.showcaseItem4'
  | 'marketing.testimonialsTitle' | 'marketing.testimonialsDesc'
  | 'marketing.pricingTitle' | 'marketing.pricingDesc'
  | 'marketing.mostPopular' | 'marketing.faqTitle'
  | 'marketing.ctaTitle' | 'marketing.ctaDesc'
  | 'marketing.scanToOrder'
  | 'marketing.statRestaurants' | 'marketing.statOrdersServed' | 'marketing.statFasterTurnover' | 'marketing.statOwnerRating'
  | 'marketing.statTodaySales' | 'marketing.statOrders' | 'marketing.statAvgTicket' | 'marketing.statRevenueWeek'
  | 'marketing.phoneTableDineIn' | 'marketing.phoneDemoCafe' | 'marketing.phonePopularSection' | 'marketing.phoneViewCart'
  | 'marketing.phoneItemBurger' | 'marketing.phoneItemPizza' | 'marketing.phoneItemLemonade'
  | 'marketing.featureQrCode' | 'marketing.featureQrCodeDesc'
  | 'marketing.featurePayments' | 'marketing.featurePaymentsDesc'
  | 'marketing.featureKitchen' | 'marketing.featureKitchenDesc'
  | 'marketing.featureStaff' | 'marketing.featureStaffDesc'
  | 'marketing.featureAnalytics' | 'marketing.featureAnalyticsDesc'
  | 'marketing.featureMultiLocation' | 'marketing.featureMultiLocationDesc'
  | 'marketing.stepMenu' | 'marketing.stepMenuDesc'
  | 'marketing.stepPrintQr' | 'marketing.stepPrintQrDesc'
  | 'marketing.stepStartServing' | 'marketing.stepStartServingDesc'
  | 'marketing.planStarterName' | 'marketing.planStarterDesc'
  | 'marketing.planStarterFeature0' | 'marketing.planStarterFeature1' | 'marketing.planStarterFeature2' | 'marketing.planStarterFeature3'
  | 'marketing.planGrowthName' | 'marketing.planGrowthDesc'
  | 'marketing.planGrowthFeature0' | 'marketing.planGrowthFeature1' | 'marketing.planGrowthFeature2' | 'marketing.planGrowthFeature3' | 'marketing.planGrowthFeature4'
  | 'marketing.planEnterpriseName' | 'marketing.planEnterpriseDesc'
  | 'marketing.planEnterpriseFeature0' | 'marketing.planEnterpriseFeature1' | 'marketing.planEnterpriseFeature2' | 'marketing.planEnterpriseFeature3' | 'marketing.planEnterpriseFeature4'
  | 'marketing.testimonial1Quote' | 'marketing.testimonial1Name' | 'marketing.testimonial1Role'
  | 'marketing.testimonial2Quote' | 'marketing.testimonial2Name' | 'marketing.testimonial2Role'
  | 'marketing.testimonial3Quote' | 'marketing.testimonial3Name' | 'marketing.testimonial3Role'
  | 'marketing.faq1Q' | 'marketing.faq1A'
  | 'marketing.faq2Q' | 'marketing.faq2A'
  | 'marketing.faq3Q' | 'marketing.faq3A'
  | 'marketing.faq4Q' | 'marketing.faq4A'
  | 'pricing.pageTitle' | 'pricing.pageDesc'
  | 'pricing.faqTitle'
  | 'pricing.planStarterDesc'
  | 'pricing.planStarterFeature0' | 'pricing.planStarterFeature1' | 'pricing.planStarterFeature2' | 'pricing.planStarterFeature3' | 'pricing.planStarterFeature4' | 'pricing.planStarterFeature5'
  | 'pricing.planGrowthDesc'
  | 'pricing.planGrowthFeature0' | 'pricing.planGrowthFeature1' | 'pricing.planGrowthFeature2' | 'pricing.planGrowthFeature3' | 'pricing.planGrowthFeature4' | 'pricing.planGrowthFeature5' | 'pricing.planGrowthFeature6' | 'pricing.planGrowthFeature7'
  | 'pricing.planEnterpriseDesc'
  | 'pricing.planEnterpriseFeature0' | 'pricing.planEnterpriseFeature1' | 'pricing.planEnterpriseFeature2' | 'pricing.planEnterpriseFeature3' | 'pricing.planEnterpriseFeature4' | 'pricing.planEnterpriseFeature5' | 'pricing.planEnterpriseFeature6' | 'pricing.planEnterpriseFeature7'
  | 'pricing.faq1Q' | 'pricing.faq1A'
  | 'pricing.faq2Q' | 'pricing.faq2A'
  | 'pricing.faq3Q' | 'pricing.faq3A'
  | 'pricing.faq4Q' | 'pricing.faq4A'
  | 'features.pageTitle' | 'features.pageDesc'
  | 'features.groupCustomers' | 'features.groupStaff' | 'features.groupManagement'
  | 'features.itemScanOrder' | 'features.itemScanOrderDesc'
  | 'features.itemPayAtTable' | 'features.itemPayAtTableDesc'
  | 'features.itemOrderTracking' | 'features.itemOrderTrackingDesc'
  | 'features.itemKitchenDisplay' | 'features.itemKitchenDisplayDesc'
  | 'features.itemRoleManagement' | 'features.itemRoleManagementDesc'
  | 'features.itemMultiTable' | 'features.itemMultiTableDesc'
  | 'features.itemAnalytics' | 'features.itemAnalyticsDesc'
  | 'features.itemMenuManagement' | 'features.itemMenuManagementDesc'
  | 'features.itemPaymentLinks' | 'features.itemPaymentLinksDesc'
  | 'contact.pageTitle' | 'contact.pageDesc'
  | 'contact.email' | 'contact.phone' | 'contact.location'
  | 'contact.formName' | 'contact.formNamePlaceholder'
  | 'contact.formEmail' | 'contact.formEmailPlaceholder'
  | 'contact.formSubject' | 'contact.formSubjectPlaceholder'
  | 'contact.formMessage' | 'contact.formMessagePlaceholder'
  | 'contact.sendMessage'
  | 'contact.successTitle' | 'contact.successDesc'
  | 'demo.pageTitle' | 'demo.pageDesc'
  | 'demo.formName' | 'demo.formNamePlaceholder'
  | 'demo.formEmail' | 'demo.formEmailPlaceholder'
  | 'demo.formRestaurant' | 'demo.formRestaurantPlaceholder'
  | 'demo.formPhone' | 'demo.formPhonePlaceholder'
  | 'demo.formSize' | 'demo.formSizePlaceholder'
  | 'demo.formSizeOption0' | 'demo.formSizeOption1' | 'demo.formSizeOption2' | 'demo.formSizeOption3'
  | 'demo.formMessage' | 'demo.formMessagePlaceholder'
  | 'demo.requestDemo' | 'demo.sending'
  | 'demo.selfServiceSetup'
  | 'demo.successTitle' | 'demo.successDesc'
  | 'demo.successExplorer' | 'demo.successWizardLink' | 'demo.successAfterLink'
  | 'demo.backToHome'
  | 'demo.errorMessage'
  | 'error.generic' | 'error.notFound' | 'error.forbidden' | 'error.serverError'
  | 'error.networkError' | 'error.tryAgain' | 'error.somethingWentWrong'
  | 'error.pageNotFound' | 'error.sessionExpired' | 'error.unauthorized'
  | 'review.cta'
  | 'tracking.title' | 'tracking.orderPlaced' | 'tracking.preparing' | 'tracking.ready'
  | 'tracking.delivered' | 'tracking.notFound' | 'tracking.loading'
  | 'tracking.autoRefresh' | 'tracking.enjoy' | 'tracking.readyForPickup'
  | 'tracking.beingPrepared'
  | 'assistant.notConfigured' | 'assistant.greeting' | 'assistant.placeholder'
  | 'assistant.s1' | 'assistant.s2' | 'assistant.s3' | 'assistant.s4'
  | 'voice.cta' | 'voice.connecting' | 'voice.listening' | 'voice.speaking' | 'voice.retry' | 'voice.stop' | 'voice.hint'
  | 'analytics.aiSummary'
  | 'marketing.aiBadge' | 'marketing.aiTitle' | 'marketing.aiDesc'
  | 'marketing.aiItem1' | 'marketing.aiItem2' | 'marketing.aiItem3'
  | 'marketing.aiChatUser' | 'marketing.aiChatBot' | 'marketing.aiChatPlaceholder'
  | 'customer.assistant.ask' | 'customer.assistant.title' | 'customer.assistant.greeting'
  | 'customer.assistant.placeholder'
  | 'customer.assistant.s1' | 'customer.assistant.s2' | 'customer.assistant.s3'
  | 'customer.assistant.addItem' | 'customer.assistant.yourCart' | 'customer.assistant.emptyCart'
  | 'customer.assistant.cartTotal' | 'customer.assistant.reviewOrder'
  | 'customer.assistant.stepReview' | 'customer.assistant.stepCheckout' | 'customer.assistant.stepOrder'
  | 'analytics.forecast' | 'analytics.projectedTotal' | 'analytics.reorderSuggestions'
  | 'analytics.allStocked' | 'analytics.reorderQty' | 'analytics.atRisk'
  | 'analytics.noData' | 'analytics.lastVisit' | 'analytics.topCustomers'
  | 'analytics.visitsCount'
  | 'hotel.title' | 'hotel.occupancy' | 'hotel.bookingRevenue' | 'hotel.bookings'
  | 'hotel.folio' | 'hotel.calendar' | 'hotel.arrivalsToday' | 'hotel.departuresToday'
  | 'marketing.featureScheduling' | 'marketing.featureSchedulingDesc'
  | 'marketing.featureInventory' | 'marketing.featureInventoryDesc'
  | 'marketing.featureForecasting' | 'marketing.featureForecastingDesc'
  | 'marketing.featureCrm' | 'marketing.featureCrmDesc'
  | 'marketing.featureMarketing' | 'marketing.featureMarketingDesc'
  | 'marketing.featureHotel' | 'marketing.featureHotelDesc'
  | 'marketing.featureRoomService' | 'marketing.featureRoomServiceDesc'
  | 'marketing.alsoTitle'
  | 'reservations.title' | 'waitlist.title' | 'giftCards.title'
  | 'pricing.perMonth' | 'pricing.fxNote';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

async function loadTranslations(locale: Locale): Promise<Record<TranslationKey, string>> {
  const mod = await import(`../lib/i18n/translations/${locale}.ts`);
  return mod.translations;
}

let fallbackTranslations: Record<TranslationKey, string> | null = null;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('locale') as Locale) || 'en';
  });
  const [translations, setTranslations] = useState<Record<TranslationKey, string> | null>(null);

  useEffect(() => {
    loadTranslations(locale).then(setTranslations);
    if (!fallbackTranslations) {
      loadTranslations('en').then((t) => { fallbackTranslations = t; });
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = translations || fallbackTranslations;
      let msg = dict?.[key] || key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          msg = msg.replace(`{${k}}`, String(v));
        }
      }
      return msg;
    },
    [translations],
  );

  const dir: 'ltr' | 'rtl' = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
