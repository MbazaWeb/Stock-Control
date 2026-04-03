import { CalendarRange } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type SalesDatePreset } from '@/lib/salesDateRange';

interface SalesDateFilterProps {
  preset: SalesDatePreset;
  startDate: string;
  endDate: string;
  onPresetChange: (preset: SalesDatePreset) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  className?: string;
}

export default function SalesDateFilter({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  className,
}: SalesDateFilterProps) {
  return (
    <div className={cn('flex flex-wrap gap-2 items-center', className)}>
      <CalendarRange className="h-4 w-4 text-muted-foreground" />
      <Select value={preset} onValueChange={(value) => onPresetChange(value as SalesDatePreset)}>
        <SelectTrigger className="w-[160px] h-8 text-xs glass-input">
          <SelectValue placeholder="Sales Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>
      {preset === 'custom' && (
        <>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="w-[150px] h-8 text-xs glass-input"
            aria-label="Start date"
          />
          <Input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="w-[150px] h-8 text-xs glass-input"
            aria-label="End date"
          />
        </>
      )}
    </div>
  );
}
