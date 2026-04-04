import { Target, TrendingUp, AlertCircle } from 'lucide-react';
import GlassCard from './GlassCard';
import { Badge } from './badge';
import { Progress } from './progress';
import { TargetMetrics } from '@/lib/targetCalculations';

interface TargetSummaryCardProps {
  title: string;
  metrics: TargetMetrics;
  achieved: number;
  earnedBy?: string;
}

export default function TargetSummaryCard({
  title,
  metrics,
  achieved,
  earnedBy,
}: TargetSummaryCardProps) {
  const progressPercent = (achieved / metrics.monthlyTarget) * 100;
  const mtdPercent = (achieved / metrics.monthlyToDate) * 100;

  return (
    <GlassCard className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {earnedBy && (
            <p className="text-xs text-muted-foreground mt-1">By: {earnedBy}</p>
          )}
        </div>

        {/* Monthly Target Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Monthly Target</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {Math.round(progressPercent)}%
            </Badge>
          </div>
          <Progress value={Math.min(progressPercent, 100)} className="h-2" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{achieved.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{metrics.monthlyTarget.toLocaleString()}</span>
          </div>
        </div>

        {/* Monthly to Date Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Month to Date</span>
            </div>
            <span className="text-xs font-medium">
              {metrics.daysElapsed} of {metrics.daysInMonth} days
            </span>
          </div>
          <Progress value={Math.min(mtdPercent, 100)} className="h-2" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{achieved.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{metrics.monthlyToDate.toLocaleString()}</span>
          </div>
        </div>

        {/* Gap Status */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {metrics.isOnTrack ? (
                <div className="flex items-center gap-1 text-green-500">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-medium">On Track</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Behind</span>
                </div>
              )}
            </div>
            <Badge
              className={
                metrics.isOnTrack
                  ? 'bg-green-500/20 text-green-500 border-green-500/30'
                  : 'bg-red-500/20 text-red-500 border-red-500/30'
              }
            >
              {metrics.isOnTrack ? '+' : ''}{metrics.monthlyToDateGap.toLocaleString()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {Math.abs(metrics.gapPercentage)}% gap from target
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
