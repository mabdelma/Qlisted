# Translation coverage

All eleven locales carry the **same key set** as `translations/en.ts`. The gap
this file used to track (19 keys added with the promo-engine, loyalty and
modifier work, never propagated) is closed, as is the Language Bridge marketing
copy added on top of it.

> Verified 2026-10-04: `en` and each of `ar de es fr hi it ja pt ru zh` have
> identical key sets — zero missing, zero extra.

Parity is not the same as quality. The non-English copy was written, not
machine-translated, but it has **not** been through native review. Worth a pass
before launch, especially:

- the `marketing.hero*` / `marketing.bridge*` block, which is the first thing a
  prospect reads, and
- `promo.*` and `loyalty.*`, where a mistranslated label sits next to a number
  a customer is being charged.

Strings with placeholders (`{points}`, `{discount}`, `{num}`, `{count}`) must
keep them verbatim in every locale — `t()` substitutes by name, so a translated
placeholder silently renders as literal text.

## How to check parity

Falling out of sync is not a build failure: non-English dictionaries are typed
`Partial<Record<TranslationKey, string>>`, so `t()` falls back to the English
string and then to the key itself. Nothing goes red — the UI just quietly turns
English for some users. Check it explicitly:

```bash
grep -oE "^  '[^']+'" src/lib/i18n/translations/en.ts | sort > /tmp/en.keys
for l in ar de es fr hi it ja pt ru zh; do
  grep -oE "^  '[^']+'" "src/lib/i18n/translations/$l.ts" | sort > "/tmp/$l.keys"
  echo "$l missing: $(comm -23 /tmp/en.keys "/tmp/$l.keys" | wc -l)"
done
```

`e2e/i18n.spec.ts` guards the marketing copy the same way at runtime: it loads
the landing page in each of the ten non-English locales and asserts the hero and
Language Bridge headings are *not* the English strings. Asserting "the heading
is not empty" is useless here, because the English fallback satisfies it.

## Why `en.ts` is the source of truth

`TranslationKey` is derived from the English dictionary
(`export type TranslationKey = keyof typeof translations`). It used to be a
hand-maintained union kept alongside the data, and a second copy lived in
`contexts/I18nContext.tsx`. Both drifted: the unions listed 618 keys while the
dictionary held 1043, which produced ~500 spurious type errors and kept CI red.
Deriving the type means a key added to `en.ts` is immediately valid everywhere
and cannot fall out of sync again.
