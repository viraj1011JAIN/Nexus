"use client";

import { AuditLog } from "@prisma/client";
import { ActivityIcon } from "lucide-react";
import { format } from "date-fns"; 
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityProps {
  items: AuditLog[];
}

const getActionText = (action: string, entityTitle: string) => {
  switch (action) {
    case "CREATE":
      return `created this card`;
    case "UPDATE":
      return `updated this card`;
    case "DELETE":
      return `deleted this card`;
    default:
      return `${action.toLowerCase()} this card`;
  }
};

export const Activity = ({ items }: ActivityProps) => {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-x-3 w-full">
        <ActivityIcon className="h-5 w-5 mt-0.5 text-neutral-700 dark:text-neutral-300" />
        <div className="w-full">
          <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Activity</p>
          <p className="text-sm text-muted-foreground mt-2">No activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-x-3 w-full">
      <ActivityIcon className="h-5 w-5 mt-0.5 text-neutral-700 dark:text-neutral-300" />
      <div className="w-full">
        <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Activity</p>
        <ol className="mt-2 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="group">
              <div className="flex flex-col space-y-1">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="font-semibold">
                    {item.userName}
                  </span>{" "}
                  {getActionText(item.action, item.entityTitle)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export const ActivitySkeleton = () => {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-6 w-6 bg-neutral-200" />
      <div className="w-full">
        <Skeleton className="w-24 h-6 mb-2 bg-neutral-200" />
        <Skeleton className="w-full h-10 bg-neutral-200" />
      </div>
    </div>
  );
};