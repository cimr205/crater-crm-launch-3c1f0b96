import { useState, useRef } from 'react';
import { Play, Square, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { useDailyBrief, useGenerateBrief } from '@/hooks/api/useDailyBrief';

function WaveformAnimation({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-center gap-0.5 h-5">
      {[0.6, 1, 0.8, 1, 0.6, 0.9, 0.7].map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-primary transition-all"
          style={{
            height: playing ? `${h * 20}px` : '4px',
            animation: playing ? `pulse ${0.4 + i * 0.07}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export function DailyBriefCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: brief, isLoading } = useDailyBrief();
  const generateMutation = useGenerateBrief();
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handlePlay = () => {
    if (!brief?.content) return;

    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      brief.content.replace(/[#*_`]/g, '') // strip markdown
    );
    utterance.lang = 'da-DK';
    utterance.rate = 1.05;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  };

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      toast({ title: t('autopilot.briefTitle') + ' genereret' });
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{t('autopilot.briefTitle')}</span>
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {brief && (
            <Button variant="ghost" size="sm" onClick={handlePlay} className="h-7 gap-1.5 text-xs">
              {playing
                ? <><Square className="h-3 w-3" /> Stop</>
                : <><Play className="h-3 w-3" /> {t('autopilot.playBrief')}</>
              }
              <WaveformAnimation playing={playing} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            {t('autopilot.generateBrief')}
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-16 w-full" />}

      {!isLoading && !brief && (
        <p className="text-sm text-muted-foreground">{t('autopilot.briefEmpty')}</p>
      )}

      {brief && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
          {brief.content}
        </div>
      )}
    </div>
  );
}
