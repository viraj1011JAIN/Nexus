"use client";

import { AuditLog } from "@prisma/client";
import { ActivityIcon } from "lucide-react";
import { format } from "date-fns"; 
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityProps {
  items: AuditLog[];
}

export const Activity = ({ items }: ActivityProps) => {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <ActivityIcon className="h-5 w-5 mt-0.5 text-neutral-700" />
      <div className="w-full">
        <p className="font-semibold text-neutral-700 mb-2">Activity</p>
        <ol className="mt-2 space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <div className="flex items-center gap-x-2">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold lowercase text-neutral-700">
                      {item.userName}
                    </span>{" "}
                    {item.action === "UPDATE" ? "updated" : "created"} this card
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
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