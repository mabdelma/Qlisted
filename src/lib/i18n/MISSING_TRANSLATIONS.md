# Untranslated keys

Keys that exist in `translations/en.ts` but in none of the other ten locales.
They were added with the promo-engine, loyalty and modifier work and never
propagated, so the UI currently falls back to the English string for every
non-English user.

This is **not** a build failure: non-English dictionaries are typed
`Partial<Record<TranslationKey, string>>` and `t()` falls back to English, then
to the key itself. It is a content gap to be filled by someone who speaks the
language — deliberately not machine-translated here.

> Generated 2026-09-26 against `en.ts` (1043 keys) vs each locale (1024 keys).

## Missing in: ar · de · es · fr · hi · it · ja · pt · ru · zh

| Key | English source |
|---|---|
| `common.select` | Select |
| `loyalty.discountApplied` | Discount applied |
| `loyalty.earnAmount` | Earn amount |
| `loyalty.manualEarn` | Manual earn |
| `loyalty.noUnpaidOrders` | No unpaid orders |
| `loyalty.orderId` | Order ID |
| `loyalty.orderTotal` | Order total |
| `loyalty.pointsToRedeem` | Points to redeem |
| `loyalty.redeemForOrder` | Redeem for order |
| `loyalty.redeemedSuccess` | Redeemed successfully |
| `loyalty.selectOrder` | Select order |
| `menu.chooseAny` | Choose any |
| `menu.chooseOne` | Choose one |
| `order.required` | Required |
| `promo.buyQuantity` | Buy quantity |
| `promo.getDiscountPercent` | Get discount percent |
| `promo.code` | Code |
| `promo.getQuantity` | Get quantity |
| `promo.noDiscount` | No discount |

Check the exact English wording in `translations/en.ts` before translating — the
table above is a summary, not the source of truth.

## How to regenerate this list

```bash
grep -oE "^  '[^']+'" src/lib/i18n/translations/en.ts | sort > /tmp/en.keys
grep -oE "^  '[^']+'" src/lib/i18n/translations/es.ts | sort > /tmp/es.keys
comm -23 /tmp/en.keys /tmp/es.keys
```

## Why `en.ts` is the source of truth

`TranslationKey` is derived from the English dictionary
(`export type TranslationKey = keyof typeof translations`). It used to be a
hand-maintained union kept alongside the data, and a second copy lived in
`contexts/I18nContext.tsx`. Both drifted: the unions listed 618 keys while the
dictionary held 1043, which produced ~500 spurious type errors and kept CI red.
Deriving the type means a key added to `en.ts` is immediately valid everywhere
and cannot fall out of sync again.
