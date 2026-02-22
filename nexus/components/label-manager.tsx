"use client";

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label as UILabel } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tag, X, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { assignLabel, unassignLabel, createLabel } from '@/actions/label-actions';
import { useOptimisticLabels, type CardLabel } from '@/hooks/use-optimistic-card';
import type { Label } from '@prisma/client';

interface LabelManagerProps {
  cardId: string;
  orgId: string;
  availableLabels: Label[];
  cardLabels: CardLabel[];
  onLabelsChange?: () => void;
}

const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#6B7280', // gray
];

export function LabelManager({
  cardId,
  orgId,
  availableLabels,
  cardLabels: initialCardLabels,
  onLabelsChange,
}: LabelManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isPending, startTransition] = useTransition();

  const { labels: cardLabels, addLabel, removeLabel } = useOptimisticLabels({
    initialLabels: initialCardLabels,
  });

  const handleToggleLabel = (label: Label) => {
    const isAssigned = cardLabels.some((l) => l.id === label.id);

    if (isAssigned) {
      // Optimistic removal
      const cardLabel = cardLabels.find((l) => l.id === label.id)!;
      removeLabel(cardLabel);

      // Server action
      startTransition(async () => {
        const result = await unassignLabel({ cardId, labelId: label.id });
        
        if (result.error) {
          toast.error(result.error);
          // Rollback happens automatically on re-render
          onLabelsChange?.();
        } else {
          toast.success('Label removed');
          onLabelsChange?.();
        }
      });
    } else {
      // Optimistic addition
      addLabel({ ...label, assignmentId: 'temp-' + Date.now() });

      // Server action
      startTransition(async () => {
        const result = await assignLabel({ cardId, labelId: label.id });
        
        if (result.error) {
          toast.error(result.error);
          // Rollback happens automatically on re-render
          onLabelsChange?.();
        } else {
          toast.success('Label added');
          onLabelsChange?.();
        }
      });
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Please enter a label name');
      return;
    }

    startTransition(async () => {
      const result = await createLabel({
        name: newLabelName.trim(),
        color: selectedColor,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Label created');
        setNewLabelName('');
        setSelectedColor(PRESET_COLORS[0]);
        setIsCreating(false);
        onLabelsChange?.();
      }
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent">
          <Tag className="h-4 w-4" />
          Labels
          {cardLabels.length > 0 && (
            <span className="ml-1 text-muted-foreground">({cardLabels.length})</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Manage Labels</h3>

        <div className="space-y-4">
          {/* Current Labels */}
          {cardLabels.length > 0 && (
            <div>
              <UILabel className="text-sm font-medium">Current Labels</UILabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {cardLabels.map((label) => (
                  <LabelBadge
                    key={label.id}
                    label={label}
                    onRemove={() => handleToggleLabel(label)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Labels */}
          <div>
            <UILabel className="text-sm font-medium">Available Labels</UILabel>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {availableLabels.map((label) => {
                const isAssigned = cardLabels.some((l) => l.id === label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => handleToggleLabel(label)}
                    disabled={isPending}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-md',
                      'border border-input hover:bg-accent hover:text-accent-foreground',
                      'transition-colors disabled:opacity-50',
                      isAssigned && 'bg-accent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm">{label.name}</span>
                    </div>
                    {isAssigned && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Create New Label */}
          {!isCreating ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Label
            </Button>
          ) : (
            <div className="space-y-3 p-3 border rounded-md">
              <Input
                placeholder="Label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                maxLength={50}
              />

              <div>
                <UILabel className="text-xs text-muted-foreground mb-2 block">
                  Choose Color
                </UILabel>
                <div className="grid grid-cols-9 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        'h-8 w-8 rounded-md transition-transform hover:scale-110',
                        selectedColor === color && 'ring-2 ring-primary ring-offset-2'
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateLabel}
                  disabled={isPending || !newLabelName.trim()}
                  className="flex-1"
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewLabelName('');
                    setSelectedColor(PRESET_COLORS[0]);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LabelBadge({
  label,
  onRemove,
}: {
  label: CardLabel;
  onRemove: () => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium text-white"
      style={{ backgroundColor: label.color }}
    >
      <span>{label.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="hover:bg-white/20 rounded-sm p-0.5 transition-colors"
        aria-label={`Remove ${label.name} label`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Compact label display for card items
export function CardLabels({ labels }: { labels: CardLabel[] }) {
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <div
          key={label.id}
          className="h-2 w-10 rounded-full"
          style={{ backgroundColor: label.color }}
          title={label.name}
          role="status"
          aria-label={`Label: ${label.name}`}
        />
      ))}
    </div>
  );
}
