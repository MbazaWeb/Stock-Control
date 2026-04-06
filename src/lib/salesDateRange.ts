export type SalesDatePreset = 'this_month' | 'last_month' | 'custom';

export interface SalesDateRange {
  preset: SalesDatePreset;
  startDate: string;
  endDate: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date: Date) => date.toISOString().split('T')[0];

const parseDate = (dateValue: string) => new Date(`${dateValue}T00:00:00`);

const normalizeDateValue = (dateValue: string) => dateValue.slice(0, 10);

const getMonthRange = (monthOffset: number, baseDate = new Date()) => {
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1);
  const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset + 1, 0);

  return {
    startDate: toIsoDate(monthStart),
    endDate: toIsoDate(monthEnd),
  };
};

export const getDefaultSalesDateRange = (baseDate = new Date()): SalesDateRange => {
  const currentMonth = getMonthRange(0, baseDate);

  return {
    preset: 'this_month',
    startDate: currentMonth.startDate,
    endDate: toIsoDate(baseDate),
  };
};

export const createSalesDateRange = (
  preset: SalesDatePreset,
  customStartDate?: string,
  customEndDate?: string,
  baseDate = new Date()
): SalesDateRange => {
  if (preset === 'last_month') {
    return {
      preset,
      ...getMonthRange(-1, baseDate),
    };
  }

  if (preset === 'custom') {
    const fallback = getDefaultSalesDateRange(baseDate);
    const startDate = customStartDate || fallback.startDate;
    const endDate = customEndDate || fallback.endDate;

    return startDate <= endDate
      ? { preset, startDate, endDate }
      : { preset, startDate: endDate, endDate: startDate };
  }

  // 'this_month' - uses today as endDate, not full month
  const result = getDefaultSalesDateRange(baseDate);
  console.log('createSalesDateRange this_month result:', result);
  return result;
};

export const getSalesDatePresetLabel = (preset: SalesDatePreset) => {
  switch (preset) {
    case 'last_month':
      return 'Last Month';
    case 'custom':
      return 'Custom Range';
    case 'this_month':
    default:
      return 'This Month';
  }
};

export const describeSalesDateRange = (range: SalesDateRange) => {
  if (range.preset !== 'custom') {
    return getSalesDatePresetLabel(range.preset);
  }

  const formatDisplayDate = (dateValue: string) =>
    parseDate(dateValue).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return `${formatDisplayDate(range.startDate)} to ${formatDisplayDate(range.endDate)}`;
};

export const isDateWithinSalesRange = (dateValue: string, range: SalesDateRange) => {
  const normalizedDate = normalizeDateValue(dateValue);

  return normalizedDate >= range.startDate && normalizedDate <= range.endDate;
};

export const listSalesDateRangeDays = (range: SalesDateRange) => {
  const days: string[] = [];
  const current = parseDate(range.startDate);
  const end = parseDate(range.endDate);

  while (current <= end) {
    days.push(toIsoDate(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

export const getSalesDateRangeDayCount = (range: SalesDateRange) => {
  const start = parseDate(range.startDate);
  const end = parseDate(range.endDate);

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1);
};

export const getPreviousSalesDateRange = (range: SalesDateRange): SalesDateRange => {
  const spanDays = getSalesDateRangeDayCount(range);
  const previousEnd = parseDate(range.startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - spanDays + 1);

  return {
    preset: 'custom',
    startDate: toIsoDate(previousStart),
    endDate: toIsoDate(previousEnd),
  };
};
