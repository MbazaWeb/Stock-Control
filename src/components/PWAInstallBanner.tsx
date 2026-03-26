import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';

export default function PWAInstallBanner() {
  const { isInstallable, install, dismiss } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:bottom-6 md:w-96 animate-slide-up">
      <div className="glass-card p-4 flex items-start gap-3 shadow-elevated border border-primary/20">
        <div className="icon-container-blue p-2 shrink-0">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install StockFlow</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add to your home screen for a faster, app-like experience.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="btn-primary-gradient text-xs h-8 px-3" onClick={install}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Install
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-8 px-3 text-muted-foreground" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
