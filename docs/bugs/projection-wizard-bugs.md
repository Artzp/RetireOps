# Bug Report: Projection Wizard & UI Issues

**Discovered:** 2026-03-07
**Method:** Manual UI testing via Playwright (dedicated e2e test user)
**Scope:** `/projections` — list, detail, new wizard, scenarios

---

## Bug Index

| #   | Title                                                      | Severity | Location                   |
| --- | ---------------------------------------------------------- | -------- | -------------------------- |
| 1   | Spouse optional number fields block wizard navigation      | High     | `new/page.tsx`, Zod schema |
| 2   | Spouse validation runs even when not married               | High     | `new/page.tsx:168`         |
| 3   | Review step is skipped — wizard auto-submits from Expenses | Medium   | `new/page.tsx`             |
| 4   | Edit button is non-functional                              | Medium   | `[id]/page.tsx:176`        |
| 5   | Scenario delete button has no label or confirmation        | Medium   | `ScenariosTab` component   |
| 6   | `/scenarios` and `/reports` pages return 404               | Medium   | App router                 |
| 7   | Date of Birth default is a Date object, not a string       | Low      | `new/page.tsx:107`         |

---

## Bug 1 — Spouse optional number fields block wizard navigation

**Severity:** High
**Status:** Open

### Description

When marital status is set to "Married" or "Common-Law", the Spouse step renders
input fields for optional number values (e.g. `incomeEndAge`, `cppStartAge`,
`oasStartAge`). If the user leaves these fields empty and clicks Next, validation
fails and the wizard cannot advance.

### Root Cause

The Zod schema uses `z.coerce.number().int().min(55).max(75).optional()` for these
fields. React Hook Form registers empty `type="number"` inputs as empty strings `""`.
`Number("") === 0`, which fails `.min(55)`. Zod's `.optional()` only exempts
`undefined` — not empty-string coercion results.

### Affected Fields

- `spouse.incomeEndAge` — min 55
- `spouse.cppStartAge` — min 60
- `spouse.oasStartAge` — min 65

### Reproduction Steps

1. Create new projection → set marital status to "Married"
2. On Spouse step, fill only Date of Birth, Retirement Age, Life Expectancy
3. Leave all other optional fields blank
4. Click Next → wizard stays on Spouse step, no error message shown

### Fix

Preprocess empty strings to `undefined` before Zod coercion for all optional
number fields with a minimum constraint:

```typescript
// Before
z.coerce.number().int().min(55).max(75).optional();

// After
z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.number().int().min(55).max(75)
).optional();
```

Or define a reusable helper:

```typescript
const optionalInt = (min: number, max: number) =>
  z
    .preprocess((v) => (v === '' || v === null ? undefined : v), z.number().int().min(min).max(max))
    .optional();
```

---

## Bug 2 — Spouse validation runs even when not married

**Severity:** High
**Status:** Open

**File:** `packages/web/src/app/(dashboard)/projections/new/page.tsx:168`

### Description

The `validateCurrentStep()` function has a comment stating spouse validation should
only run for married/common-law users, but the implementation always triggers it.
If a user was previously married, entered spouse data, then changed to "Single",
the cached spouse form values fail validation and block navigation permanently.

### Root Cause

```typescript
case 1:
  // Spouse step - validate spouse fields only if married/commonLaw  ← comment is correct
  return trigger(['spouse', 'coupleSettings']);                       ← code ignores it
```

### Fix

```typescript
case 1: {
  const maritalStatus = methods.getValues('personalInfo.maritalStatus');
  const isMarriedOrCommonLaw =
    maritalStatus === 'married' || maritalStatus === 'commonLaw';
  if (!isMarriedOrCommonLaw) return true;
  return trigger(['spouse', 'coupleSettings']);
}
```

---

## Bug 3 — Review step is skipped — wizard auto-submits from Expenses

**Severity:** Medium
**Status:** Open

**File:** `packages/web/src/app/(dashboard)/projections/new/page.tsx`

### Description

When clicking Next on the Expenses step (step index 4), the wizard advances to
step 5 (Review) and React re-renders. The navigation button changes from
`type="button"` (Next) to `type="submit"` (Create Projection). The browser
appears to auto-submit the form at this point — the user never sees the Review
step and the projection is created immediately.

### Reproduction Steps

1. Start a new projection with default (Single) marital status
2. Fill Name and Date of Birth on step 1, click Next through all steps
3. On the Expenses step, click Next
4. Observe: browser navigates directly to the new projection detail page —
   Review step was never shown

### Likely Cause

When `setCurrentStep(5)` triggers a React re-render, the "Create Projection"
`type="submit"` button may receive focus automatically, and a residual Enter/click
event from the previous "Next" button click triggers form submission.

### Fix Options

- Change "Create Projection" to `type="button"` with an explicit `onClick={handleSubmit(onSubmit)}`
- Or add `autoFocus={false}` and ensure no focus is transferred on re-render
- Or add a `e.preventDefault()` guard at the submit handler level

---

## Bug 4 — Edit button is non-functional

**Severity:** Medium
**Status:** Open

**File:** `packages/web/src/app/(dashboard)/projections/[id]/page.tsx:176`

### Description

The Edit button on the projection detail page has no `onClick` handler and is not
wrapped in a link. Clicking it does nothing.

### Root Cause

```tsx
<Button variant="outline" size="sm">
  <Edit2 className="mr-2 h-4 w-4" />
  Edit
</Button>
```

No `onClick`, no `href`, no router navigation.

### Fix

Navigate to the projection's edit page (which may need to be created):

```tsx
<Button variant="outline" size="sm" onClick={() => router.push(`/projections/${id}/edit`)}>
  <Edit2 className="mr-2 h-4 w-4" />
  Edit
</Button>
```

---

## Bug 5 — Scenario delete button has no label or confirmation

**Severity:** Medium
**Status:** Open

### Description

Each scenario card in the Scenarios tab has an icon-only button that deletes the
scenario. It has:

- No `aria-label` (inaccessible)
- No tooltip
- No confirmation dialog

Clicking it immediately and permanently deletes the scenario.

### Fix

1. Add `aria-label="Delete scenario"` to the button
2. Add a confirmation dialog (e.g. shadcn `AlertDialog`) before deletion:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Delete scenario">
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Bug 6 — `/scenarios` and `/reports` pages return 404

**Severity:** Medium
**Status:** Open

### Description

Both navigation links in the sidebar point to pages that do not exist:

- `/scenarios` → 404
- `/reports` → 404

These are linked prominently in the main nav but return Next.js 404 errors.

### Fix

Either:

- Implement the pages
- Or replace the nav links with "Coming Soon" placeholder pages to avoid broken navigation

---

## Bug 7 — Date of Birth default value is a Date object, not a string

**Severity:** Low
**Status:** Open

**File:** `packages/web/src/app/(dashboard)/projections/new/page.tsx:107`

### Description

The form `defaultValues` sets `dateOfBirth` as a JavaScript `Date` object:

```typescript
personalInfo: {
  dateOfBirth: new Date('1975-01-01'),  // Date object
```

A `type="date"` HTML input requires a `yyyy-MM-dd` string. When React Hook Form
sets a Date object on the input, the browser logs a warning and the field renders
blank, forcing the user to re-enter their date of birth.

### Console Warning

```
The specified value "Tue Dec 31 1974 19:00:00 GMT-0500" does not conform
to the required format "yyyy-MM-dd".
```

### Fix

```typescript
personalInfo: {
  dateOfBirth: '1975-01-01',  // string, not new Date(...)
```

Note: The Zod schema uses `z.coerce.date()` which will coerce the string to a
Date correctly on validation.
