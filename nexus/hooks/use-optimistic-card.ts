import { useOptimistic } from 'react';
import type { Label } from '@prisma/client';

export type CardLabel = Label & {
  assignmentId?: string; // The ID of the CardLabelAssignment
};

interface UseOptimisticLabelsProps {
  initialLabels: CardLabel[];
}

export function useOptimisticLabels({ initialLabels }: UseOptimisticLabelsProps) {
  const [optimisticLabels, setOptimisticLabel] = useOptimistic<
    CardLabel[],
    { action: 'add' | 'remove'; label: CardLabel }
  >(initialLabels, (state, { action, label }) => {
    if (action === 'add') {
      // Add label optimistically
      return [...state, label];
    } else {
      // Remove label optimistically
      return state.filter((l) => l.id !== label.id);
    }
  });

  const addLabel = (label: CardLabel) => {
    setOptimisticLabel({ action: 'add', label });
  };

  const removeLabel = (label: CardLabel) => {
    setOptimisticLabel({ action: 'remove', label });
  };

  return {
    labels: optimisticLabels,
    addLabel,
    removeLabel,
  };
}

/**
 * Optimistic Assignee Hook
 * 
 * Provides instant feedback when assigning/unassigning users to cards.
 */
interface UseOptimisticAssigneeProps {
  initialAssignee: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
}

export function useOptimisticAssignee({ initialAssignee }: UseOptimisticAssigneeProps) {
  const [optimisticAssignee, setOptimisticAssignee] = useOptimistic<
    typeof initialAssignee,
    typeof initialAssignee
  >(initialAssignee, (state, newAssignee) => {
    return newAssignee;
  });

  const updateAssignee = (assignee: typeof initialAssignee) => {
    setOptimisticAssignee(assignee);
  };

  return {
    assignee: optimisticAssignee,
    updateAssignee,
  };
}
