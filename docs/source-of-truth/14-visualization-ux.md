# 14 - Visualization and UX Specification

## Overview

This document specifies the chart types, color system, page layout, interactive behaviors, PDF report format, and mobile responsiveness requirements for RetireOps. All visualizations are powered by Recharts and must present projection data clearly while maintaining the disclaimer requirements defined in [13-compliance-scope.md](./13-compliance-scope.md).

---

## Color System

### Base Palette

The color system uses HSL values to ensure consistent rendering across light and dark modes. These values match the existing `COLORS` object in `ChartsTab.tsx`.

| Token     | HSL Value          | Hex Approx. | Usage                                  |
| --------- | ------------------ | ----------- | -------------------------------------- |
| `primary` | hsl(221, 83%, 53%) | #2563EB     | RRSP/RRIF, CPP, primary data series    |
| `green`   | hsl(142, 76%, 36%) | #16A34A     | TFSA, OAS, positive indicators         |
| `amber`   | hsl(38, 92%, 50%)  | #F59E0B     | Non-registered, withdrawals, warnings  |
| `purple`  | hsl(280, 65%, 60%) | #A855F7     | Pension income, LIRA/LIF               |
| `red`     | hsl(346, 77%, 49%) | #DC2626     | Tax lines, negative indicators, danger |

### Extended Palette (New Account Types)

| Token    | HSL Value          | Hex Approx. | Usage                         |
| -------- | ------------------ | ----------- | ----------------------------- |
| `slate`  | hsl(215, 16%, 47%) | #64748B     | Cash/HISA                     |
| `teal`   | hsl(175, 60%, 40%) | #0D9488     | Corporate investment account  |
| `rose`   | hsl(350, 89%, 60%) | #FB7185     | Real estate / property value  |
| `indigo` | hsl(245, 58%, 51%) | #6366F1     | GIS, secondary benefit series |

### Account-to-Color Canonical Mapping

| Account / Series | Color Token | Purpose                                  |
| ---------------- | ----------- | ---------------------------------------- |
| RRSP             | `primary`   | Net worth stacked area, allocation donut |
| RRIF             | `primary`   | Same as RRSP (post-conversion)           |
| TFSA             | `green`     | Net worth stacked area, allocation donut |
| Non-Registered   | `amber`     | Net worth stacked area, allocation donut |
| LIRA             | `purple`    | Net worth stacked area (if present)      |
| LIF              | `purple`    | Same as LIRA (post-conversion)           |
| Cash/HISA        | `slate`     | Net worth stacked area (if present)      |
| Corporate        | `teal`      | Net worth stacked area (if present)      |
| Real Estate      | `rose`      | Net worth stacked area (if present)      |
| CPP/QPP          | `primary`   | Income bar chart                         |
| OAS              | `green`     | Income bar chart                         |
| GIS              | `indigo`    | Income bar chart                         |
| Pension          | `purple`    | Income bar chart                         |
| Withdrawals      | `amber`     | Income bar chart                         |
| Federal Tax      | `primary`   | Tax line chart                           |
| Provincial Tax   | `red`       | Tax line chart                           |

---

## Chart Specifications

### Chart 1: Net Worth Over Time (Stacked Area)

| Property     | Value                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------- |
| Type         | `AreaChart` (stacked)                                                                    |
| X-axis       | Age (or Year, toggleable)                                                                |
| Y-axis       | Dollar amount (formatted: $1.2M, $500K)                                                  |
| Series       | One area per account type (RRSP, TFSA, Non-Reg, LIRA, LIF, Cash, Corporate, Real Estate) |
| Stack order  | Bottom to top: Cash, Non-Reg, Corporate, RRSP/RRIF, LIRA/LIF, TFSA, Real Estate          |
| Fill opacity | 0.6                                                                                      |
| Tooltip      | Shows age, year, and balance for each account                                            |
| Total line   | Optional dashed line showing total net worth                                             |

### Chart 2: Retirement Income Sources (Stacked Bar)

| Property           | Value                                                      |
| ------------------ | ---------------------------------------------------------- |
| Type               | `BarChart` (stacked)                                       |
| X-axis             | Age (retirement years only)                                |
| Y-axis             | Annual income ($)                                          |
| Series             | Pension, CPP, OAS, GIS, Withdrawals, Rental Income         |
| Stack order        | Bottom to top: Pension, CPP, OAS, GIS, Withdrawals, Rental |
| Max bars displayed | 15 per view (paginate or scroll for longer projections)    |
| Tooltip            | Shows income breakdown by source for the selected year     |

### Chart 3: Tax Burden Over Time (Line)

| Property     | Value                                           |
| ------------ | ----------------------------------------------- |
| Type         | `LineChart`                                     |
| X-axis       | Age (or Year)                                   |
| Y-axis       | Tax amount ($)                                  |
| Series       | Federal tax (`primary`), Provincial tax (`red`) |
| Stroke width | 2px                                             |
| Dots         | Off (dot={false})                               |
| Tooltip      | Shows federal, provincial, and total tax        |

### Chart 4: Account Allocation at Retirement (Donut)

| Property     | Value                                   |
| ------------ | --------------------------------------- |
| Type         | `PieChart` (donut)                      |
| Data         | Account balances at the retirement year |
| Inner radius | 50                                      |
| Outer radius | 80                                      |
| Colors       | Per account-to-color mapping above      |
| Label        | Account name + percentage               |
| Tooltip      | Account name + dollar amount            |

### Chart 5: Monte Carlo Probability Fan (Advanced)

| Property     | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Type         | `AreaChart` (layered, not stacked)                            |
| X-axis       | Age                                                           |
| Y-axis       | Net worth ($)                                                 |
| Bands        | P10-P90 (lightest), P25-P75 (medium), P50 median (solid line) |
| Fill opacity | P10-P90: 0.15, P25-P75: 0.30                                  |
| Color        | All bands use `primary` at different opacities                |
| Median line  | Solid, stroke width 2px                                       |
| Tooltip      | Shows P10, P25, P50, P75, P90 values at cursor age            |

### Chart 6: Withdrawal by Source (Stacked Bar, Retirement Only)

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Type     | `BarChart` (stacked)                       |
| X-axis   | Age (retirement years only)                |
| Y-axis   | Withdrawal amount ($)                      |
| Series   | One bar segment per account withdrawn from |
| Colors   | Per account-to-color mapping               |
| Tooltip  | Shows withdrawal amount from each account  |

---

## Interactive Elements

### Tooltips

- Appear on hover over any data point or chart element
- Format: white background card with subtle shadow
- Content: relevant data values formatted as currency ($1,234)
- Dismiss: on mouse leave

### Axis Toggle

- Net worth and tax charts support toggling X-axis between "Age" and "Year"
- Default: Age
- Toggle control: small segmented button above the chart

### Legend Interaction

- Clicking a legend item toggles that series on/off
- Disabled series: legend text becomes muted, series hidden from chart
- At least one series must remain visible

---

## Page Layout

### Tab Structure

The projection results page uses a tabbed layout:

| Tab              | Content                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **Summary**      | Key metrics cards (total net worth at retirement, success probability, monthly income, tax summary) |
| **Charts**       | All 6 chart types arranged in a responsive grid                                                     |
| **Year-by-Year** | Detailed table with one row per projection year, all values shown                                   |
| **Scenarios**    | Side-by-side comparison of up to 3 scenarios (if scenarios exist)                                   |

### Charts Tab Layout

```
┌─────────────────────────────────────────────┐
│  Net Worth Over Time (full width)           │
│  [Stacked Area Chart]                       │
├──────────────────────┬──────────────────────┤
│  Income Sources      │  Account Allocation  │
│  [Stacked Bar]       │  [Donut Chart]       │
├──────────────────────┴──────────────────────┤
│  Tax Burden Over Time (full width)          │
│  [Line Chart]                               │
├──────────────────────┬──────────────────────┤
│  Withdrawal by Source│  Monte Carlo Fan     │
│  [Stacked Bar]       │  [Area Chart]        │
└──────────────────────┴──────────────────────┘
```

### Summary Tab Metrics

| Metric                   | Format         | Description                                                  |
| ------------------------ | -------------- | ------------------------------------------------------------ |
| Net worth at retirement  | $X.XM or $XXXK | Total portfolio value at retirement age                      |
| Projected monthly income | $X,XXX/mo      | Average monthly after-tax income in first 5 retirement years |
| Plan success probability | XX%            | From Monte Carlo simulation (if available)                   |
| Estimated lifetime tax   | $X.XM          | Sum of all federal + provincial tax over projection          |
| Years funds last         | Age XX         | Age at which portfolio reaches $0 (or "Lifetime" if never)   |

---

## PDF Report Generation

### Report Sections

| Section                | Content                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| 1. Cover Page          | Report title, user name, generation date, advisor branding (optional)                      |
| 2. Disclaimer          | Full disclaimer text (VR-DISC-003 from [13-compliance-scope.md](./13-compliance-scope.md)) |
| 3. Executive Summary   | Key metrics table (same as Summary tab)                                                    |
| 4. Assumptions         | Input parameters table (inflation, returns, retirement age, life expectancy)               |
| 5. Net Worth Chart     | Stacked area chart rendered as static image                                                |
| 6. Income Projection   | Income sources bar chart + table                                                           |
| 7. Tax Summary         | Tax line chart + year-by-year tax table                                                    |
| 8. Year-by-Year Table  | Complete projection data (paginated, landscape orientation if needed)                      |
| 9. Scenario Comparison | Side-by-side scenario metrics (if applicable)                                              |

### Formatting Rules

| Rule                | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| Page size           | Letter (8.5" x 11")                                                  |
| Margins             | 0.75" all sides                                                      |
| Font                | System sans-serif, 10pt body, 14pt headings                          |
| Chart rendering     | Static PNG at 2x resolution for print quality                        |
| Footer (every page) | "For educational purposes only. Not financial advice." + page number |
| Header (pages 2+)   | Report title + generation date                                       |

### Advisor Branding

| Field                | Placement                      |
| -------------------- | ------------------------------ |
| Advisor/firm name    | Cover page, below report title |
| Firm logo (optional) | Cover page, top-right corner   |
| Contact information  | Cover page, below firm name    |

> Advisor branding never replaces or reduces the disclaimer. Both must appear per VR-DISC-003.

---

## Mobile Responsiveness

### Breakpoints

| Breakpoint | Width          | Layout                                                         |
| ---------- | -------------- | -------------------------------------------------------------- |
| Desktop    | >= 1024px      | Full grid layout as specified above                            |
| Tablet     | 768px - 1023px | Charts stack to single column, 2-column grid for paired charts |
| Mobile     | < 768px        | Single column, full-width charts, horizontal scroll for tables |

### Mobile-Specific Adjustments

- Charts: minimum height 250px, respect container width
- Year-by-year table: horizontal scroll with sticky first column (Age)
- Tabs: horizontally scrollable tab bar if tabs overflow
- Tooltips: tap to show (instead of hover), tap elsewhere to dismiss
- PDF export: same layout regardless of device (server-side rendering)

---

## Test Cases

### TC-VIZ-001: Net Worth Chart Renders All Account Types

**Input:** Projection with RRSP, TFSA, non-registered, and LIRA accounts.

**Expected:**

- Stacked area chart renders with 4 distinct colored areas
- Colors match account-to-color mapping (primary, green, amber, purple)
- Y-axis formats large values ($1.2M, $500K)
- Tooltip shows all 4 account balances on hover

---

### TC-VIZ-002: Income Chart Shows Retirement Years Only

**Input:** User age 55, retirement age 65, life expectancy 95.

**Expected:**

- Bar chart X-axis starts at age 65
- Pre-retirement years (55-64) are not shown
- Income sources stacked correctly (pension, CPP, OAS, withdrawals)

---

### TC-VIZ-003: PDF Disclaimer Compliance

**Input:** User exports projection as PDF.

**Expected:**

- Page 1 (or Section 2): full disclaimer text present
- Pages 2+: footer contains "For educational purposes only. Not financial advice."
- VR-DISC-003 from [13-compliance-scope.md](./13-compliance-scope.md) is satisfied

---

### TC-VIZ-004: Mobile Responsive Layout

**Input:** View projection results on a 375px-wide viewport.

**Expected:**

- All charts render in single column at full container width
- Minimum chart height: 250px
- Year-by-year table scrolls horizontally
- Tab bar scrolls horizontally if needed
- No horizontal overflow on the page body

---

### TC-VIZ-005: Axis Toggle Functionality

**Input:** User clicks the "Year" toggle on the net worth chart (default is "Age").

**Expected:**

- X-axis labels switch from age values (55, 60, 65...) to year values (2026, 2031, 2036...)
- All data points remain the same; only the axis label changes
- Toggle state persists while on the Charts tab

---

## Cross-References

- [08-projection-engine.md](./08-projection-engine.md) — Data structure driving all charts
- [09-success-metrics.md](./09-success-metrics.md) — Monte Carlo probability data for fan chart
- [06-investment-engine.md](./06-investment-engine.md) — Return assumptions shown in PDF report
- [13-compliance-scope.md](./13-compliance-scope.md) — Disclaimer text and placement rules (VR-DISC-001 through VR-DISC-004)
