import { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export function StatsCard({ title, value, icon: Icon, iconColor = 'text-brand-600 dark:text-brand-400', iconBgColor = 'bg-brand-100 dark:bg-brand-900/60' }: StatsCardProps) {
  return (
    <Card padded>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBgColor}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
          <p className="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </Card>
  );
}
