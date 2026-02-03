// Utility functions for consistent formatting

import { formatDistanceToNow, isValid, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * Handles invalid dates gracefully
 */
export function formatRelativeDate(date: string | Date | undefined | null): string {
  if (!date) return 'Never';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) return 'Invalid date';
    
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Group items by date categories (Today, Yesterday, This Week, Earlier)
 */
export function groupByDateCategory<T extends { createdAt: string | Date }>(
  items: T[]
): {
  today: T[];
  yesterday: T[];
  thisWeek: T[];
  earlier: T[];
} {
  const groups = {
    today: [] as T[],
    yesterday: [] as T[],
    thisWeek: [] as T[],
    earlier: [] as T[],
  };

  items.forEach((item) => {
    try {
      const date = typeof item.createdAt === 'string' 
        ? parseISO(item.createdAt) 
        : item.createdAt;
      
      if (!isValid(date)) {
        groups.earlier.push(item);
        return;
      }

      if (isToday(date)) {
        groups.today.push(item);
      } else if (isYesterday(date)) {
        groups.yesterday.push(item);
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(item);
      } else {
        groups.earlier.push(item);
      }
    } catch (error) {
      groups.earlier.push(item);
    }
  });

  return groups;
}

/**
 * Get initials from a name (e.g., "John Doe" => "JD")
 */
export function getInitials(name: string): string {
  if (!name) return '??';
  
  const parts = name.trim().split(' ');
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format number with commas (e.g., 1000 => "1,000")
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}
