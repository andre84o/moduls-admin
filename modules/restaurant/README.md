# Restaurant module

## Gating

| Gate | Typ | Kontroll |
|---|---|---|
| `ProjectType.RESTAURANT` | Modul | Aktiveras per business av super admin via `Project`-tabellen |
| `CATERING` | Add-on | Aktiveras per business av super admin via `BusinessFeatureAccess`-tabellen |

Catering-sektioner visas **bara** om RESTAURANT är aktiv **och** CATERING add-on är aktiverad.

---

## Databas

Inga egna tabeller. Restaurang använder `website_sections` (Prisma: `WebsiteSection`) precis som Website — diskriminerat via `type`-kolumnen.

Varje rad har: `id`, `businessId`, `pageId`, `type`, `draftContent`, `publishedContent`, `internalName` (i content-JSON), `updatedAt`.

---

## Section types

| Type | Add-on krävs | Beskrivning |
|---|---|---|
| `menuList` | — | Matkategorier med rätter och priser |
| `cateringMenus` | CATERING | Cateringmenyer (Meny 1–3 + vegetarisk) med rätter och taggar |
| `cateringIntro` | CATERING | Sidintro ovanför cateringmenyerna (rubrik, ingress, notering, pris/gäst) |

Definieras i `modules/restaurant/section-types.ts`:
- `RESTAURANT_SECTION_TYPES` — alla typer som hör till Restaurant-tabben
- `CATERING_SECTION_TYPES` — typer som kräver CATERING add-on (`cateringMenus`, `cateringIntro`)

---

## Filer

```
modules/restaurant/
  section-types.ts        – set-konstanter + isRestaurantSectionType / isCateringSectionType
  guards.ts               – requireRestaurantModule() / isRestaurantEnabled()
  queries.ts              – isCateringAddOnEnabled()

modules/catering/
  actions.ts              – submitCateringRequest() (publik förfrågan, honeypot, e-post)
  config.ts               – CATERING_MENUS (statisk fallback-lista)

components/CateringForm/
  index.tsx               – Publikt 3-stegsformulär för cateringförfrågan

app/catering/
  page.tsx                – Preview-sida för formuläret (ej auth-skyddad)

app/admin/_components/sections/restaurant/
  index.tsx               – RestaurantSection (flat sektionslista, inline rename, sticky knappar)

app/admin/_components/sections/website/
  index.tsx               – SectionEditor (delad), SECTION_META för alla restaurant-typer
  section-fields.tsx      – CateringMenusFields, CateringIntroFields, MenuListFields
```

---

## Admin-flöde

`app/admin/page.tsx` → anropar `isCateringAddOnEnabled()` → skickar `cateringAddOnEnabled` till `AdminShell` → filtrerar bort catering-typer ur `restaurantPages` om add-on är av → `RestaurantSection` får redan filtrerad lista.

---

## Vad som INTE finns (och inte ska skapas)

- Inga egna Prisma-modeller för menyer — allt bor i `WebsiteSection`
- Ingen egen `foodMenu`- eller `drinksMenu`-typ — använd `menuList` med `internalName` för att namnge
- Ingen separat CATERING-modul — det är ett add-on ovanpå RESTAURANT
- Ingen `pageId`-dropdown i Restaurant-tabben — sektionerna är en flat lista oavsett sida
