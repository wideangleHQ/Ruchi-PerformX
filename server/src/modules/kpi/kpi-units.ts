/**
 * The unit library behind the search box on the KPI form.
 *
 * A number means nothing until a unit is attached to it: ten employees, ten
 * percent and ten lakh rupees are three different goals built from the same
 * five. Rather than a long dropdown, the HOD types the target and then types
 * what it is.
 *
 * ponytail: a constant, not a table. Units are read-only reference data that
 * changes about once a year, and the chosen label is copied onto the KPI row,
 * so a KPI already running does not move when this list is edited. Ceiling: a
 * department cannot add a unit for everyone else to find, only for its own KPI.
 * Upgrade path is a `kpi_units` table seeded from this array, read in place of
 * it in `searchUnits`, on the day somebody asks for a shared custom unit.
 */

/** Search groups. They make searching easier and nothing else: there is one
 * scoring engine behind all of them. */
export type KpiUnitGroup =
  | 'Currency'
  | 'Percentage'
  | 'Time'
  | 'Quantity'
  | 'People'
  | 'Business Metrics';

export interface KpiUnit {
  /** Stable across renames of `label`. Not stored; the label and symbol are. */
  code: string;
  label: string;
  symbol: string;
  group: KpiUnitGroup;
  /** Extra words that should find this unit. Lower case. */
  aliases?: string[];
}

export const KPI_UNITS: readonly KpiUnit[] = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', group: 'Currency', aliases: ['rupee', 'rs', 'inr', 'revenue', 'lakh', 'crore'] },
  { code: 'USD', label: 'US Dollar', symbol: '$', group: 'Currency', aliases: ['dollar', 'usd'] },
  { code: 'EUR', label: 'Euro', symbol: '€', group: 'Currency', aliases: ['euro', 'eur'] },
  { code: 'GBP', label: 'Pound Sterling', symbol: '£', group: 'Currency', aliases: ['pound', 'gbp', 'sterling'] },
  { code: 'AED', label: 'UAE Dirham', symbol: 'AED', group: 'Currency', aliases: ['dirham', 'aed'] },

  { code: 'PCT', label: 'Percentage', symbol: '%', group: 'Percentage', aliases: ['percent', 'percentage', 'rate', 'share'] },
  { code: 'PCT_POINT', label: 'Percentage Point', symbol: 'pp', group: 'Percentage', aliases: ['percentage point', 'pp'] },

  { code: 'HOUR', label: 'Hours', symbol: 'hrs', group: 'Time', aliases: ['hour', 'turnaround', 'tat'] },
  { code: 'MINUTE', label: 'Minutes', symbol: 'min', group: 'Time', aliases: ['minute'] },
  { code: 'DAY', label: 'Days', symbol: 'days', group: 'Time', aliases: ['day', 'lead time'] },
  { code: 'WEEK', label: 'Weeks', symbol: 'wks', group: 'Time', aliases: ['week'] },
  { code: 'MONTH', label: 'Months', symbol: 'mos', group: 'Time', aliases: ['month'] },

  { code: 'COUNT', label: 'Count', symbol: 'nos', group: 'Quantity', aliases: ['count', 'number', 'nos', 'units'] },
  { code: 'KG', label: 'Kilograms', symbol: 'kg', group: 'Quantity', aliases: ['kilogram', 'weight', 'kg'] },
  { code: 'TONNE', label: 'Tonnes', symbol: 't', group: 'Quantity', aliases: ['tonne', 'ton'] },
  { code: 'LITRE', label: 'Litres', symbol: 'L', group: 'Quantity', aliases: ['litre', 'liter', 'volume'] },
  { code: 'CASE', label: 'Cases', symbol: 'cases', group: 'Quantity', aliases: ['case', 'carton', 'box'] },
  { code: 'BATCH', label: 'Batches', symbol: 'batches', group: 'Quantity', aliases: ['batch', 'production run'] },

  { code: 'EMPLOYEE', label: 'Employees', symbol: 'emp', group: 'People', aliases: ['employee', 'headcount', 'staff', 'hire', 'hires'] },
  { code: 'CANDIDATE', label: 'Candidates', symbol: 'cand', group: 'People', aliases: ['candidate', 'applicant', 'interview'] },
  { code: 'CUSTOMER', label: 'Customers', symbol: 'cust', group: 'People', aliases: ['customer', 'client', 'account'] },
  { code: 'VISITOR', label: 'Visitors', symbol: 'vis', group: 'People', aliases: ['visitor', 'footfall'] },
  { code: 'VENDOR', label: 'Vendors', symbol: 'vend', group: 'People', aliases: ['vendor', 'supplier'] },

  { code: 'TICKET', label: 'Tickets', symbol: 'tkts', group: 'Business Metrics', aliases: ['ticket'] },
  { code: 'SUPPORT_TICKET', label: 'Support Tickets', symbol: 'tkts', group: 'Business Metrics', aliases: ['support ticket', 'ticket', 'helpdesk'] },
  { code: 'RESOLVED_TICKET', label: 'Resolved Tickets', symbol: 'tkts', group: 'Business Metrics', aliases: ['resolved ticket', 'ticket', 'closure'] },
  { code: 'ORDER', label: 'Orders', symbol: 'ord', group: 'Business Metrics', aliases: ['order', 'po', 'purchase order'] },
  { code: 'INVOICE', label: 'Invoices', symbol: 'inv', group: 'Business Metrics', aliases: ['invoice', 'bill'] },
  { code: 'COMPLAINT', label: 'Complaints', symbol: 'comp', group: 'Business Metrics', aliases: ['complaint', 'grievance'] },
  { code: 'AUDIT', label: 'Audits', symbol: 'audits', group: 'Business Metrics', aliases: ['audit', 'inspection', 'compliance'] },
  { code: 'DOCUMENT', label: 'Documents', symbol: 'docs', group: 'Business Metrics', aliases: ['document', 'sop', 'record'] },
  { code: 'DELIVERY', label: 'Deliveries', symbol: 'del', group: 'Business Metrics', aliases: ['delivery', 'dispatch', 'shipment'] },
] as const;

/** Direct hit on the code, the label, or one of the aliases. */
function matches(unit: KpiUnit, term: string): boolean {
  if (unit.code.toLowerCase().includes(term)) return true;
  if (unit.label.toLowerCase().includes(term)) return true;
  return (unit.aliases ?? []).some((alias) => alias.includes(term));
}

/**
 * Units for a search box, direct matches first and then the rest of the groups
 * those matches came from.
 *
 * The group pass is what makes "rupee" return the other currencies too, which
 * is the behaviour the framework describes and the reason someone looking for
 * a dirham finds it without knowing the word. It is additive, so a direct match
 * is never pushed below a sibling.
 *
 * An empty or whitespace query returns the whole library, in library order.
 */
export function searchUnits(query: string, limit = 20): KpiUnit[] {
  const term = query.trim().toLowerCase();
  if (!term) return KPI_UNITS.slice(0, limit);

  const direct = KPI_UNITS.filter((unit) => matches(unit, term));
  const groups = new Set(direct.map((unit) => unit.group));
  const siblings = KPI_UNITS.filter(
    (unit) => groups.has(unit.group) && !direct.includes(unit),
  );

  return [...direct, ...siblings].slice(0, limit);
}

/** The library entry for a code, or undefined for a department's own unit. */
export function findUnit(code: string): KpiUnit | undefined {
  return KPI_UNITS.find((unit) => unit.code === code);
}
