'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ComparableSale {
  source: string;
  price: number;
  condition: string;
  soldDate: string;
  listingUrl?: string;
}

export interface MarketDataTableProps {
  sales: ComparableSale[];
  title?: string;
}

export function MarketDataTable({
  sales,
  title = 'Recent Sales',
}: MarketDataTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (sales.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{sale.source}</TableCell>
                <TableCell>{formatCurrency(sale.price)}</TableCell>
                <TableCell>{sale.condition}</TableCell>
                <TableCell>
                  {new Date(sale.soldDate).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
