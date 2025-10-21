'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ComparableSale {
  id: string;
  source: string; // e.g., "eBay", "TCGPlayer", "PriceCharting"
  date: string; // ISO 8601 date string
  price: number;
  condition: string; // e.g., "Near Mint", "Lightly Played"
  url?: string; // Optional link to the sale
}

export interface MarketDataTableProps {
  data: ComparableSale[];
  className?: string;
}

type SortField = 'date' | 'price' | 'source' | 'condition';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format relative time (e.g., "2 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

/**
 * Sort comparator function
 */
function sortComparator(
  a: ComparableSale,
  b: ComparableSale,
  field: SortField,
  direction: SortDirection
): number {
  let comparison = 0;

  switch (field) {
    case 'date':
      comparison =
        new Date(a.date).getTime() - new Date(b.date).getTime();
      break;
    case 'price':
      comparison = a.price - b.price;
      break;
    case 'source':
      comparison = a.source.localeCompare(b.source);
      break;
    case 'condition':
      comparison = a.condition.localeCompare(b.condition);
      break;
  }

  return direction === 'asc' ? comparison : -comparison;
}

// ============================================================================
// Mobile Card View
// ============================================================================

function MobileCard({ sale }: { sale: ComparableSale }) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-lg">
            {formatCurrency(sale.price)}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {formatRelativeTime(sale.date)}
          </p>
        </div>
        <span className="text-xs font-medium px-2 py-1 bg-[var(--muted)] rounded">
          {sale.source}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">
          Condition
        </span>
        <span className="font-medium">{sale.condition}</span>
      </div>
      {sale.url && (
        <a
          href={sale.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--vault-blue)] hover:underline"
        >
          View listing →
        </a>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function MarketDataTable({
  data,
  className,
}: MarketDataTableProps) {
  const [sortField, setSortField] = React.useState<SortField>('date');
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>('desc');

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort data
  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) =>
      sortComparator(a, b, sortField, sortDirection)
    );
  }, [data, sortField, sortDirection]);

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Recent Comparable Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-[var(--muted-foreground)]">
            <p className="text-sm">
              No comparable sales data available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Comparable Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-gradient-to-r from-[var(--color-holo-cyan)]/10 to-[var(--color-vault-blue)]/10">
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('source')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Source
                    <SortIcon field="source" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('date')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Date
                    <SortIcon field="date" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('price')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Price
                    <SortIcon field="price" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('condition')}
                    className="h-8 px-2 lg:px-3"
                  >
                    Condition
                    <SortIcon field="condition" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">
                    {sale.source}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {formatRelativeTime(sale.date)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {formatCurrency(sale.price)}
                    </span>
                  </TableCell>
                  <TableCell>{sale.condition}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {sortedData.map((sale) => (
            <MobileCard key={sale.id} sale={sale} />
          ))}
        </div>

        {/* Data source note */}
        <p className="text-xs text-[var(--muted-foreground)] mt-4 pt-4 border-t">
          Note: Comparable sales data is aggregated from multiple
          marketplaces and updated regularly. Prices may vary based on
          condition, seller, and market conditions.
        </p>
      </CardContent>
    </Card>
  );
}
