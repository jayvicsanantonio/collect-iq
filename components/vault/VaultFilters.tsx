'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface VaultFilters {
  set?: string;
  type?: string;
  rarity?: string;
  authenticityMin?: number;
  sortBy: 'value' | 'date' | 'rarity';
  sortOrder: 'asc' | 'desc';
}

export interface VaultFiltersProps {
  filters: VaultFilters;
  onFiltersChange: (filters: VaultFilters) => void;
  availableSets: string[];
  availableTypes: string[];
}

/**
 * VaultFilters component
 * - Filter UI for set, type, rarity, authenticity
 * - Sort dropdown (value, date added, rarity)
 * - Filter chips showing active filters
 * - Clear all filters action
 */
export function VaultFilters({
  filters,
  onFiltersChange,
  availableSets,
}: VaultFiltersProps) {
  const updateFilter = (key: keyof VaultFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value,
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    onFiltersChange({
      set: undefined,
      type: undefined,
      rarity: undefined,
      authenticityMin: undefined,
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  // Get active filters for chips
  const activeFilters: Array<{ key: keyof VaultFilters; label: string; value: string }> = [];
  if (filters.set) {
    activeFilters.push({ key: 'set', label: 'Set', value: filters.set });
  }
  if (filters.type) {
    activeFilters.push({ key: 'type', label: 'Type', value: filters.type });
  }
  if (filters.rarity) {
    activeFilters.push({ key: 'rarity', label: 'Rarity', value: filters.rarity });
  }
  if (filters.authenticityMin !== undefined) {
    activeFilters.push({
      key: 'authenticityMin',
      label: 'Authenticity',
      value: `≥${Math.round(filters.authenticityMin * 100)}%`,
    });
  }

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="set-filter" className="mb-2 block">
            Set
          </Label>
          <Select
            value={filters.set || 'all'}
            onValueChange={(value) => updateFilter('set', value)}
          >
            <SelectTrigger id="set-filter">
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

        <div>
          <Label htmlFor="rarity-filter" className="mb-2 block">
            Rarity
          </Label>
          <Select
            value={filters.rarity || 'all'}
            onValueChange={(value) => updateFilter('rarity', value)}
          >
            <SelectTrigger id="rarity-filter">
              <SelectValue placeholder="All Rarities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rarities</SelectItem>
              <SelectItem value="Common">Common</SelectItem>
              <SelectItem value="Uncommon">Uncommon</SelectItem>
              <SelectItem value="Rare">Rare</SelectItem>
              <SelectItem value="Holo Rare">Holo Rare</SelectItem>
              <SelectItem value="Ultra Rare">Ultra Rare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="sort-by-filter" className="mb-2 block">
            Sort By
          </Label>
          <Select
            value={filters.sortBy}
            onValueChange={(value) =>
              updateFilter('sortBy', value as 'value' | 'date' | 'rarity')
            }
          >
            <SelectTrigger id="sort-by-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date Added</SelectItem>
              <SelectItem value="value">Value</SelectItem>
              <SelectItem value="rarity">Rarity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="sort-order-filter" className="mb-2 block">
            Order
          </Label>
          <Select
            value={filters.sortOrder}
            onValueChange={(value) =>
              updateFilter('sortOrder', value as 'asc' | 'desc')
            }
          >
            <SelectTrigger id="sort-order-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">
            Active filters:
          </span>
          {activeFilters.map((filter) => (
            <Button
              key={filter.key}
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => updateFilter(filter.key, undefined)}
            >
              {filter.label}: {filter.value}
              <X className="ml-1 h-3 w-3" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
