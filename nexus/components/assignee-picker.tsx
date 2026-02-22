"use client";

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar } from '@/components/ui/avatar';
import { User, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { assignUser, unassignUser } from '@/actions/assignee-actions';
import { useOptimisticAssignee } from '@/hooks/use-optimistic-card';

interface AssigneePickerProps {
  cardId: string;
  orgId: string;
  currentAssignee: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  availableUsers: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    email: string;
  }>;
  onAssigneeChange?: () => void;
}

export function AssigneePicker({
  cardId,
  orgId,
  currentAssignee: initialAssignee,
  availableUsers,
  onAssigneeChange,
}: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { assignee, updateAssignee } = useOptimisticAssignee({
    initialAssignee,
  });

  const handleSelectUser = (user: typeof availableUsers[0]) => {
    // Optimistic update
    updateAssignee({
      id: user.id,
      name: user.name,
      imageUrl: user.imageUrl,
    });

    // Server action
    startTransition(async () => {
      const result = await assignUser({
        cardId,
        assigneeId: user.id,
      });

      if (result.error) {
        toast.error(result.error);
        // Rollback happens automatically on re-render
        onAssigneeChange?.();
      } else {
        toast.success(`Assigned to ${user.name}`);
        setIsOpen(false);
        onAssigneeChange?.();
      }
    });
  };

  const handleUnassign = () => {
    // Optimistic update
    updateAssignee(null);

    // Server action
    startTransition(async () => {
      const result = await unassignUser({ cardId });

      if (result.error) {
        toast.error(result.error);
        // Rollback happens automatically on re-render
        onAssigneeChange?.();
      } else {
        toast.success('Assignee removed');
        setIsOpen(false);
        onAssigneeChange?.();
      }
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent">
          <User className="h-4 w-4" />
          {assignee ? (
            <div className="flex items-center gap-2">
              <UserAvatar user={assignee} size="sm" />
              <span className="max-w-[100px] truncate">{assignee.name}</span>
            </div>
          ) : (
            'Assign'
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Assign Member</h3>

        <div className="space-y-2">
          {/* Current Assignee */}
          {assignee && (
            <div className="p-3 bg-accent rounded-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar user={assignee} size="md" />
                <div>
                  <p className="text-sm font-medium">{assignee.name}</p>
                  <p className="text-xs text-muted-foreground">Current assignee</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnassign}
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Available Users */}
          <div className="max-h-60 overflow-y-auto space-y-1">
            {availableUsers.map((user) => {
              const isCurrentAssignee = assignee?.id === user.id;
              
              return (
                <button
                  key={user.id}
                  onClick={() => !isCurrentAssignee && handleSelectUser(user)}
                  disabled={isPending || isCurrentAssignee}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-md',
                    'border border-input hover:bg-accent hover:text-accent-foreground',
                    'transition-colors disabled:opacity-50',
                    isCurrentAssignee && 'bg-accent cursor-default'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} size="md" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  {isCurrentAssignee && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserAvatar({
  user,
  size = 'md',
}: {
  user: { name: string; imageUrl: string | null };
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-5 w-5 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  return (
    <Avatar className={cn('flex items-center justify-center bg-primary text-primary-foreground', sizeClasses[size])}>
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={user.name}
          className="h-full w-full object-cover rounded-full"
        />
      ) : (
        <span className="font-semibold">
          {user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </span>
      )}
    </Avatar>
  );
}

// Compact assignee display for card items
export function CardAssignee({
  assignee,
}: {
  assignee: { name: string; imageUrl: string | null } | null;
}) {
  if (!assignee) return null;

  return (
    <div className="flex items-center gap-1.5" title={`Assigned to ${assignee.name}`}>
      <UserAvatar user={assignee} size="sm" />
    </div>
  );
}
