import { supabase } from '@/integrations/supabase/client';

export type AuditTargetType = 'team_leader' | 'captain' | 'dsr';

export interface AuditMetrics {
  captainCount: number;
  dsrCount: number;
  soldSmartcards: string[];
  stockInHandSmartcards: string[];
  unpaidSmartcards: string[];
  noPackageSmartcards: string[];
}

export const emptyAuditMetrics: AuditMetrics = {
  captainCount: 0,
  dsrCount: 0,
  soldSmartcards: [],
  stockInHandSmartcards: [],
  unpaidSmartcards: [],
  noPackageSmartcards: [],
};

function getCurrentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

  return { startDate, endDate };
}

function uniqueSmartcards(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean)));
}

export async function fetchAuditMetrics(targetType: AuditTargetType, ids: {
  teamLeaderId?: string | null;
  captainId?: string | null;
  dsrId?: string | null;
}): Promise<AuditMetrics> {
  const { startDate, endDate } = getCurrentMonthRange();

  if (targetType === 'team_leader' && ids.teamLeaderId) {
    const { data: captains, error: captainError } = await supabase
      .from('captains')
      .select('id')
      .eq('team_leader_id', ids.teamLeaderId);

    if (captainError) throw captainError;

    const captainIds = (captains || []).map((captain) => captain.id);
    const { data: dsrs, error: dsrError } = captainIds.length > 0
      ? await supabase.from('dsrs').select('id').in('captain_id', captainIds)
      : { data: [], error: null };

    if (dsrError) throw dsrError;

    const [salesRes, unpaidRes, noPackageRes, inventoryRes] = await Promise.all([
      supabase.from('sales_records').select('smartcard_number').eq('team_leader_id', ids.teamLeaderId).gte('sale_date', startDate).lte('sale_date', endDate),
      supabase.from('sales_records').select('smartcard_number').eq('team_leader_id', ids.teamLeaderId).eq('payment_status', 'Unpaid'),
      supabase.from('sales_records').select('smartcard_number').eq('team_leader_id', ids.teamLeaderId).eq('package_status', 'No Package'),
      supabase.from('inventory').select('smartcard_number').eq('assigned_to_type', 'team_leader').eq('assigned_to_id', ids.teamLeaderId).eq('status', 'assigned'),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (unpaidRes.error) throw unpaidRes.error;
    if (noPackageRes.error) throw noPackageRes.error;
    if (inventoryRes.error) throw inventoryRes.error;

    const sales = salesRes.data || [];
    const unpaidSales = unpaidRes.data || [];
    const noPackageSales = noPackageRes.data || [];

    return {
      captainCount: captainIds.length,
      dsrCount: (dsrs || []).length,
      soldSmartcards: uniqueSmartcards(sales.map((sale) => sale.smartcard_number)),
      stockInHandSmartcards: uniqueSmartcards((inventoryRes.data || []).map((item) => item.smartcard_number)),
      unpaidSmartcards: uniqueSmartcards(unpaidSales.map((sale) => sale.smartcard_number)),
      noPackageSmartcards: uniqueSmartcards(noPackageSales.map((sale) => sale.smartcard_number)),
    };
  }

  if (targetType === 'captain' && ids.captainId) {
    const { data: dsrs, error: dsrError } = await supabase
      .from('dsrs')
      .select('id')
      .eq('captain_id', ids.captainId);

    if (dsrError) throw dsrError;

    const [salesRes, unpaidRes, noPackageRes, inventoryRes] = await Promise.all([
      supabase.from('sales_records').select('smartcard_number').eq('captain_id', ids.captainId).gte('sale_date', startDate).lte('sale_date', endDate),
      supabase.from('sales_records').select('smartcard_number').eq('captain_id', ids.captainId).eq('payment_status', 'Unpaid'),
      supabase.from('sales_records').select('smartcard_number').eq('captain_id', ids.captainId).eq('package_status', 'No Package'),
      supabase.from('inventory').select('smartcard_number').eq('assigned_to_type', 'captain').eq('assigned_to_id', ids.captainId).eq('status', 'assigned'),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (unpaidRes.error) throw unpaidRes.error;
    if (noPackageRes.error) throw noPackageRes.error;
    if (inventoryRes.error) throw inventoryRes.error;

    const sales = salesRes.data || [];
    const unpaidSales = unpaidRes.data || [];
    const noPackageSales = noPackageRes.data || [];

    return {
      captainCount: 0,
      dsrCount: (dsrs || []).length,
      soldSmartcards: uniqueSmartcards(sales.map((sale) => sale.smartcard_number)),
      stockInHandSmartcards: uniqueSmartcards((inventoryRes.data || []).map((item) => item.smartcard_number)),
      unpaidSmartcards: uniqueSmartcards(unpaidSales.map((sale) => sale.smartcard_number)),
      noPackageSmartcards: uniqueSmartcards(noPackageSales.map((sale) => sale.smartcard_number)),
    };
  }

  if (targetType === 'dsr' && ids.dsrId) {
    const [salesRes, unpaidRes, noPackageRes, inventoryRes] = await Promise.all([
      supabase.from('sales_records').select('smartcard_number').eq('dsr_id', ids.dsrId).gte('sale_date', startDate).lte('sale_date', endDate),
      supabase.from('sales_records').select('smartcard_number').eq('dsr_id', ids.dsrId).eq('payment_status', 'Unpaid'),
      supabase.from('sales_records').select('smartcard_number').eq('dsr_id', ids.dsrId).eq('package_status', 'No Package'),
      supabase.from('inventory').select('smartcard_number').eq('assigned_to_type', 'dsr').eq('assigned_to_id', ids.dsrId).eq('status', 'assigned'),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (unpaidRes.error) throw unpaidRes.error;
    if (noPackageRes.error) throw noPackageRes.error;
    if (inventoryRes.error) throw inventoryRes.error;

    const sales = salesRes.data || [];
    const unpaidSales = unpaidRes.data || [];
    const noPackageSales = noPackageRes.data || [];

    return {
      captainCount: 0,
      dsrCount: 0,
      soldSmartcards: uniqueSmartcards(sales.map((sale) => sale.smartcard_number)),
      stockInHandSmartcards: uniqueSmartcards((inventoryRes.data || []).map((item) => item.smartcard_number)),
      unpaidSmartcards: uniqueSmartcards(unpaidSales.map((sale) => sale.smartcard_number)),
      noPackageSmartcards: uniqueSmartcards(noPackageSales.map((sale) => sale.smartcard_number)),
    };
  }

  return emptyAuditMetrics;
}