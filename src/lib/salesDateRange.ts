// /lib/salesDateRange.ts

export type SalesDatePreset = 'this_month' | 'last_month' | 'custom';

export interface SalesDateRange {
  preset: SalesDatePreset;
  startDate: string;
  endDate: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// CRITICAL FIX: Use local date to avoid timezone issues
// This ensures dates are compared as YYYY-MM-DD without timezone shifts
const toLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const normalizeDateValue = (dateValue: string) => dateValue.slice(0, 10);

const getMonthRange = (monthOffset: number, baseDate = new Date()) => {
  // Use local date to avoid timezone shifts
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + monthOffset;
  
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  return {
    startDate: toLocalDate(monthStart),
    endDate: toLocalDate(monthEnd),
  };
};

export const getDefaultSalesDateRange = (baseDate = new Date()): SalesDateRange => {
  const currentMonth = getMonthRange(0, baseDate);

  // For "this_month", use today as endDate, not end of month
  // This ensures we only show sales FROM the start of month TO today
  const today = toLocalDate(baseDate);

  return {
    preset: 'this_month',
    startDate: currentMonth.startDate,
    endDate: today,  // Use today, not end of month
  };
};

export const createSalesDateRange = (
  preset: SalesDatePreset,
  customStartDate?: string,
  customEndDate?: string,
  baseDate = new Date()
): SalesDateRange => {
  if (preset === 'last_month') {
    const range = getMonthRange(-1, baseDate);
    console.log('[SalesDate] Last Month Range:', range);
    return {
      preset,
      startDate: range.startDate,
      endDate: range.endDate,
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

  // 'this_month' - uses today as endDate, not end of month
  const range = getMonthRange(0, baseDate);
  const today = toLocalDate(baseDate);
  
  console.log('[SalesDate] This Month (April 1 to TODAY):', {
    startDate: range.startDate,
    endDate: today,
    calculated: range.endDate,
    note: 'Using TODAY not end-of-month'
  });
  
  return {
    preset,
    startDate: range.startDate,
    endDate: today,  // ← FIX: Use today, not end of month
  };
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

  const formatDisplayDate = (dateValue: string) => {
    const date = parseLocalDate(dateValue);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return `${formatDisplayDate(range.startDate)} to ${formatDisplayDate(range.endDate)}`;
};

export const isDateWithinSalesRange = (dateValue: string, range: SalesDateRange) => {
  const normalizedDate = normalizeDateValue(dateValue);
  const result = normalizedDate >= range.startDate && normalizedDate <= range.endDate;
  
  // Debug logging for March 31 specifically
  if (normalizedDate === '2026-03-31') {
    console.log('[SalesDate] Checking March 31 against range:', {
      date: normalizedDate,
      startDate: range.startDate,
      endDate: range.endDate,
      isWithin: result,
      startCompare: normalizedDate >= range.startDate,
      endCompare: normalizedDate <= range.endDate
    });
  }
  
  return result;
};

export const listSalesDateRangeDays = (range: SalesDateRange) => {
  const days: string[] = [];
  const current = parseLocalDate(range.startDate);
  const end = parseLocalDate(range.endDate);

  while (current <= end) {
    days.push(toLocalDate(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

export const getSalesDateRangeDayCount = (range: SalesDateRange) => {
  const start = parseLocalDate(range.startDate);
  const end = parseLocalDate(range.endDate);

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1);
};

export const getPreviousSalesDateRange = (range: SalesDateRange): SalesDateRange => {
  const spanDays = getSalesDateRangeDayCount(range);
  const previousEnd = parseLocalDate(range.startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - spanDays + 1);

  return {
    preset: 'custom',
    startDate: toLocalDate(previousStart),
    endDate: toLocalDate(previousEnd),
  };
};