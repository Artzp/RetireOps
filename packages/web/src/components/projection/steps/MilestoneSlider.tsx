/* eslint-disable @typescript-eslint/restrict-template-expressions */
'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface MilestoneSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  milestones?: number[];
}

const MILESTONE_AGES = [60, 65, 70];

export function MilestoneSlider({
  value,
  onChange,
  min = 55,
  max = 75,
  step = 1,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  milestones = MILESTONE_AGES,
}: MilestoneSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Local state ensures the label and fill update immediately on drag,
  // independent of whether the parent re-renders via watch/setValue.
  const [localValue, setLocalValue] = useState(value);

  // Sync with prop when the form initialises or resets from outside.
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step)),
    [min, max, step]
  );

  const fillPercent = ((localValue - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return localValue;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const raw = min + ratio * (max - min);
      return clamp(raw);
    },
    [min, max, clamp, localValue]
  );

  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const newValue = getValueFromPosition(e.clientX);
      setLocalValue(newValue);
      onChange(newValue);
      isDragging.current = true;
    },
    [getValueFromPosition, onChange]
  );

  const handleThumbMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newValue = getValueFromPosition(e.clientX);
      setLocalValue(newValue);
      onChange(newValue);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getValueFromPosition, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let newValue = localValue;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          newValue = clamp(localValue + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          newValue = clamp(localValue - step);
          break;
        case 'Home':
          e.preventDefault();
          newValue = min;
          break;
        case 'End':
          e.preventDefault();
          newValue = max;
          break;
        default:
          return;
      }
      setLocalValue(newValue);
      onChange(newValue);
    },
    [localValue, step, min, max, clamp, onChange]
  );

  return (
    <div className="w-full space-y-3">
      {/* Value label */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ds-on-background">{localValue} years old</span>
      </div>

      {/* Slider track container */}
      <div
        ref={trackRef}
        className="relative w-full h-2 bg-ds-surface-raised rounded-full cursor-pointer"
        onMouseDown={handleTrackMouseDown}
      >
        {/* Fill */}
        <div
          className="absolute left-0 top-0 h-2 bg-ds-primary rounded-full pointer-events-none"
          style={{ width: `${fillPercent}%` }}
        />

        {/* Thumb */}
        <div
          role="slider"
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-valuenow={localValue}
          aria-valuemin={min}
          aria-valuemax={max}
          tabIndex={0}
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ds-primary border-2 border-ds-on-primary shadow-md cursor-grab active:cursor-grabbing focus:outline-none focus:ring-4 focus:ring-ds-tertiary-fixed/40 transition-shadow"
          style={{ left: `calc(${fillPercent}% - 12px)` }}
          onMouseDown={handleThumbMouseDown}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Milestone tick marks */}
      <div className="relative w-full mt-2 h-6">
        {milestones
          .filter((age) => age >= min && age <= max)
          .map((age) => {
            const tickPercent = ((age - min) / (max - min)) * 100;
            return (
              <div
                key={age}
                className="absolute flex flex-col items-center"
                style={{ left: `${tickPercent}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-1 bg-ds-outline-variant" />
                <span className="text-xs text-muted-foreground mt-0.5">{age}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
