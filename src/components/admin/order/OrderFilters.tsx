import { Search } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

interface OrderFiltersProps {
  statusFilter: string;
  searchQuery: string;
  timeFilter: string;
  paymentFilter: string;
  onStatusFilterChange: (status: string) => void;
  onSearchChange: (query: string) => void;
  onTimeFilterChange: (time: string) => void;
  onPaymentFilterChange: (status: string) => void;
}

export function OrderFilters({
  statusFilter,
  searchQuery,
  timeFilter,
  paymentFilter,
  onStatusFilterChange,
  onSearchChange,
  onTimeFilterChange,
  onPaymentFilterChange
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="flex-1">
        <Input
          type="text"
          placeholder="Search orders by table..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          aria-label="Search orders"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter by status"
          placeholder="All Status"
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'preparing', label: 'Preparing' },
            { value: 'ready', label: 'Ready' },
            { value: 'delivered', label: 'Delivered' },
          ]}
          className="sm:w-40"
        />
        <Select
          value={paymentFilter}
          onChange={(e) => onPaymentFilterChange(e.target.value)}
          aria-label="Filter by payment"
          options={[
            { value: 'all', label: 'All Payments' },
            { value: 'unpaid', label: 'Unpaid Orders' },
            { value: 'partially', label: 'Partially Paid' },
            { value: 'paid', label: 'Fully Paid' },
          ]}
          className="sm:w-44"
        />
        <Select
          value={timeFilter}
          onChange={(e) => onTimeFilterChange(e.target.value)}
          aria-label="Filter by time"
          options={[
            { value: 'all', label: 'All Time' },
            { value: 'today', label: 'Today' },
            { value: 'hour', label: 'Last Hour' },
            { value: 'delayed', label: 'Delayed' },
          ]}
          className="sm:w-40"
        />
      </div>
    </div>
  );
}
