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

  return (
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
  );
}
