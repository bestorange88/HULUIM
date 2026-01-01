import React from 'react';
import { Signal, SignalLow, SignalMedium, SignalHigh, SignalZero } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type CallQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

interface CallQualityIndicatorProps {
  quality: CallQuality;
  rtt?: number; // Round trip time in ms
  packetLoss?: number; // Packet loss percentage
  jitter?: number; // Jitter in ms
}

const qualityConfig = {
  excellent: {
    icon: SignalHigh,
    color: 'text-green-500',
    label: '优秀',
    bars: 4
  },
  good: {
    icon: SignalMedium,
    color: 'text-green-400',
    label: '良好',
    bars: 3
  },
  fair: {
    icon: SignalLow,
    color: 'text-yellow-500',
    label: '一般',
    bars: 2
  },
  poor: {
    icon: SignalZero,
    color: 'text-red-500',
    label: '较差',
    bars: 1
  },
  unknown: {
    icon: Signal,
    color: 'text-muted-foreground',
    label: '检测中',
    bars: 0
  }
};

const CallQualityIndicator: React.FC<CallQualityIndicatorProps> = ({
  quality,
  rtt,
  packetLoss,
  jitter
}) => {
  const config = qualityConfig[quality];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          {/* Signal Bars */}
          <div className="flex items-end gap-0.5 h-4">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={`w-1 rounded-sm transition-all ${
                  bar <= config.bars
                    ? quality === 'excellent' ? 'bg-green-500'
                      : quality === 'good' ? 'bg-green-400'
                      : quality === 'fair' ? 'bg-yellow-500'
                      : quality === 'poor' ? 'bg-red-500'
                      : 'bg-muted-foreground/30'
                    : 'bg-muted-foreground/30'
                }`}
                style={{ height: `${bar * 25}%` }}
              />
            ))}
          </div>
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs space-y-1">
          <p className="font-medium">网络质量: {config.label}</p>
          {rtt !== undefined && <p>延迟: {rtt.toFixed(0)} ms</p>}
          {packetLoss !== undefined && <p>丢包率: {packetLoss.toFixed(1)}%</p>}
          {jitter !== undefined && <p>抖动: {jitter.toFixed(1)} ms</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Calculate quality based on metrics
export const calculateQuality = (
  rtt?: number,
  packetLoss?: number,
  jitter?: number
): CallQuality => {
  if (rtt === undefined && packetLoss === undefined) {
    return 'unknown';
  }

  // Scoring based on metrics
  let score = 100;

  if (rtt !== undefined) {
    if (rtt > 300) score -= 40;
    else if (rtt > 200) score -= 25;
    else if (rtt > 100) score -= 10;
  }

  if (packetLoss !== undefined) {
    if (packetLoss > 5) score -= 40;
    else if (packetLoss > 2) score -= 25;
    else if (packetLoss > 0.5) score -= 10;
  }

  if (jitter !== undefined) {
    if (jitter > 50) score -= 20;
    else if (jitter > 30) score -= 10;
    else if (jitter > 15) score -= 5;
  }

  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
};

export default CallQualityIndicator;
