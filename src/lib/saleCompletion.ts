export const isSaleComplete = (dsrId: string | null | undefined) => Boolean(dsrId);

export const getSaleCompletionLabel = (dsrId: string | null | undefined) =>
  isSaleComplete(dsrId) ? 'Complete' : 'Incomplete / Not Scanned';

export const getSaleCompletionBadgeClass = (dsrId: string | null | undefined) =>
  isSaleComplete(dsrId)
    ? 'bg-green-500/20 text-green-500 border-green-500/30'
    : 'bg-amber-500/20 text-amber-500 border-amber-500/30';