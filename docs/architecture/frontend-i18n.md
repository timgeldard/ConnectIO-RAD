# Frontend Internationalization

The frontend apps share i18n behavior through `@connectio/shared-frontend-i18n`.
English is the default language. The supported language set includes:

- English (`en`)
- French (`fr`)
- Spanish (`es`)
- German (`de`)
- Simplified Chinese (`zh-Hans`)
- Traditional Chinese (`zh-Hant`)
- Japanese (`ja`)
- Portuguese (`pt`)
- Indonesian (`id`)
- Malay (`ms`)
- Gaeilge (`ga`)
- Polish (`pl`)
- Dutch (`nl`)
- Ukrainian (`uk`)
- Danish (`da`)

Chinese support is split into Simplified and Traditional variants to ensure correct script rendering across different regions.

## Shared Responsibilities

`libs/shared-frontend-i18n` owns:

- language registry
- browser language detection
- localStorage persistence
- English fallback
- `I18nProvider`
- `useI18n`
- `LanguageSelector`
- `Intl` number and date formatting helpers

Apps own their domain dictionaries in:

```text
apps/<app>/frontend/src/i18n/resources.json
```

## Dictionary Rules

Dictionaries use flat keys. Each app must include `en`, `fr`, `es`, and `de`,
and every locale must have the same keys as English.

Use interpolation instead of string concatenation:

```json
{
  "warehouse.subtitle.today": "Live operations — {{time}}"
}
```

Then call:

```ts
t("warehouse.subtitle.today", { time })
```

Do not translate data returned by Databricks in this pass. Material IDs, batch
IDs, plant names, table names, units, and raw operational data should remain as
provided by the backend until language-specific data retrieval is designed.

## Validation

Run:

```sh
npm run check:i18n
```

This validates language presence, key parity with English, and non-empty string
values. `npm run check:repo` also runs the i18n validator.
