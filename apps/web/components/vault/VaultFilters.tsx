'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, SlidersHorizontal } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================================================
// Types
// ============================================================================

export interface VaultFilters {
  set?: string;
  type?: string;
  rarity?: string;
  authenticityMin?: number;
  sortBy: 'value' | 'date' | 'rarity';
  sortOrder: 'asc' | 'desc';
}

interface VaultFiltersProps {
  filters: VaultFilters;
  onFiltersChange: (filters: VaultFilters) => void;
  availableSets?: string[];
  availableTypes?: string[];
  availableRarities?: string[];
}

// ============================================================================
// Filter Chip Component
// ============================================================================

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--vault-blue)]/10 px-3 py-1 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 rounded-full hover:bg-[var(--vault-blue)]/20 p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VaultFilters({
  filters,
  onFiltersChange,
  availableSets = [],
  availableTypes = [],
  availableRarities = ['Common', 'Uncommon', 'Rare', 'Holo Rare', 'Ultra Rare'],
}: VaultFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = React.useState(false);

  // Update URL query parameters when filters change
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Set filter params
    if (filters.set) params.set('set', filters.set);
    else params.delete('set');

    if (filters.type) params.set('type', filters.type);
    else params.delete('type');

    if (filters.rarity) params.set('rarity', filters.rarity);
    else params.delete('rarity');

    if (filters.authenticityMin !== undefined)
      params.set('authenticityMin', filters.authenticityMin.toString());
    else params.delete('authenticityMin');

    params.set('sortBy', filters.sortBy);
    params.set('sortOrder', filters.sortOrder);

    // Update URL without page reload
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, router, searchParams]);

  // Handle filter changes
  const handleSetChange = (value: string) => {
    onFiltersChange({
      ...filters,
      set: value === 'all' ? undefined : value,
    });
  };

  const handleTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      type: value === 'all' ? undefined : value,
    });
  };

  const handleRarityChange = (value: string) => {
    onFiltersChange({
      ...filters,
      rarity: value === 'all' ? undefined : value,
    });
  };

  const handleAuthenticityChange = (value: string) => {
    onFiltersChange({
      ...filters,
      authenticityMin: value === 'all' ? undefined : parseFloat(value),
    });
  };

  const handleSortChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortBy: value as 'value' | 'date' | 'rarity',
    });
  };

  // Clear all filters
  const handleClearAll = () => {
    onFiltersChange({
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.set ||
    filters.type ||
    filters.rarity ||
    filters.authenticityMin !== undefined;

  // Get active filter chips
  const getActiveFilterChips = () => {
    const chips: Array<{ label: string; value: string; key: string }> = [];

    if (filters.set) {
      chips.push({ label: 'Set', value: filters.set, key: 'set' });
    }
    if (filters.type) {
      chips.push({ label: 'Type', value: filters.type, key: 'type' });
    }
    if (filters.rarity) {
      chips.push({ label: 'Rarity', value: filters.rarity, key: 'rarity' });
    }
    if (filters.authenticityMin !== undefined) {
      chips.push({
        label: 'Authenticity',
        value: `≥${Math.round(filters.authenticityMin * 100)}%`,
        key: 'authenticity',
      });
    }

    return chips;
  };

  return (
    <div className="space-y-4">
      {/* Filter Toggle and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
            aria-expanded={showFilters}
            aria-controls="filter-panel"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-[var(--vault-blue)] px-2 py-0.5 text-xs text-white">
                {getActiveFilterChips().length}
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-[var(--muted-foreground)]"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">
            Sort by:
          </span>
          <Select value={filters.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date Added</SelectItem>
              <SelectItem value="value">Value</SelectItem>
              <SelectItem value="rarity">Rarity</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {getActiveFilterChips().map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              value={chip.value}
              onRemove={() => {
                const newFilters = { ...filters };
                if (chip.key === 'set') newFilters.set = undefined;
                if (chip.key === 'type') newFilters.type = undefined;
                if (chip.key === 'rarity') newFilters.rarity = undefined;
                if (chip.key === 'authenticity')
                  newFilters.authenticityMin = undefined;
                onFiltersChange(newFilters);
              }}
            />
          ))}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <Card id="filter-panel" role="region" aria-label="Filter options">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Set Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Set</label>
                <Select
                  value={filters.set || 'all'}
                  onValueChange={handleSetChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sets</SelectItem>
                    {availableSets.map((set) => (
                      <SelectItem key={set} value={set}>
                        {set}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select
                  value={filters.type || 'all'}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rarity Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Rarity</label>
                <Select
                  value={filters.rarity || 'all'}
                  onValueChange={handleRarityChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Rarities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rarities</SelectItem>
                    {availableRarities.map((rarity) => (
                      <SelectItem key={rarity} value={rarity}>
                        {rarity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Authenticity Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Authenticity
                </label>
                <Select
                  value={
                    filters.authenticityMin !== undefined
                      ? filters.authenticityMin.toString()
                      : 'all'
                  }
                  onValueChange={handleAuthenticityChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Cards" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cards</SelectItem>
                    <SelectItem value="0.8">≥ 80% (High)</SelectItem>
                    <SelectItem value="0.5">≥ 50% (Medium)</SelectItem>
                    <SelectItem value="0">≥ 0% (All)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
