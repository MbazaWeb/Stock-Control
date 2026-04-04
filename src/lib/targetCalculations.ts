/**
 * Target calculation utilities for sales targets
 */

export interface TargetMetrics {
  monthlyTarget: number;
  dailyTarget: number;
  daysInMonth: number;
  daysElapsed: number;
  monthlyToDate: number;
  monthlyToDateGap: number;
  gapPercentage: number;
  isOnTrack: boolean;
}

export interface DistributedTarget {
  id: string;
  name: string;
  target: number;
  achieved: number;
  gap: number;
  percentage: number;
}

/**
 * Calculate target metrics for a given month and actual achieved amount
 */
export function calculateTargetMetrics(
  monthlyTarget: number,
  actualAchieved: number,
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth()
): TargetMetrics {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const daysElapsed = today.getDate();
  
  const dailyTarget = monthlyTarget / daysInMonth;
  const monthlyToDate = Math.floor(dailyTarget * daysElapsed);
  const monthlyToDateGap = monthlyToDate - actualAchieved;
  const gapPercentage = monthlyToDate > 0 ? (monthlyToDateGap / monthlyToDate) * 100 : 0;
  const isOnTrack = actualAchieved >= monthlyToDate;

  return {
    monthlyTarget,
    dailyTarget: Math.round(dailyTarget),
    daysInMonth,
    daysElapsed,
    monthlyToDate,
    monthlyToDateGap,
    gapPercentage: Math.round(gapPercentage * 100) / 100,
    isOnTrack,
  };
}

/**
 * Calculate metrics for multiple items (for distribution visualization)
 */
export function calculateDistributedTargets(
  items: Array<{ id: string; name: string; target: number; achieved: number }>
): DistributedTarget[] {
  const totalTarget = items.reduce((sum, item) => sum + item.target, 0);

  return items.map((item) => {
    const achieved = item.achieved || 0;
    const gap = item.target - achieved;
    const percentage = totalTarget > 0 ? (achieved / item.target) * 100 : 0;

    return {
      id: item.id,
      name: item.name,
      target: item.target,
      achieved,
      gap,
      percentage: Math.round(percentage * 100) / 100,
    };
  });
}

/**
 * Get month name from month number (0-11)
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month] || '';
}

/**
 * Get current month and year
 */
export function getCurrentMonthYear(): { year: number; month: number; monthName: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = getMonthName(month);

  return { year, month, monthName };
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

/**
 * Calculate gap color based on performance
 */
export function getGapStatusColor(isOnTrack: boolean, gapPercentage: number): string {
  if (isOnTrack) return 'text-green-600 bg-green-50 border-green-200';
  if (gapPercentage > -20) return 'text-yellow-600 bg-yellow-50 border-yellow-200'; // Within 20% gap
  return 'text-red-600 bg-red-50 border-red-200'; // More than 20% gap
}

/**
 * Calculate gap badge variant based on performance
 */
export function getGapBadgeVariant(isOnTrack: boolean, gapPercentage: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (isOnTrack) return 'default';
  if (gapPercentage > -20) return 'secondary';
  return 'destructive';
}
