'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
// @ts-expect-error - react-window types may not be fully compatible
import { FixedSizeGrid } from 'react-window';
import { type Card as CardType } from '@collectiq/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRovingTabindex } from '@/hooks/use-roving-tabindex';
import { getCardThumbnailAlt } from '@/lib/alt-text';
import {
  BLUR_DATA_URL,
  getCardImageSizes,
  getCardImageUrl,
} from '@/lib/image-optimization';

// ============================================================================
// Types
// ============================================================================

interface VaultGridProps {
  cards: CardType[];
  isLoading?: boolean;
  onRefresh?: (cardId: string) => void;
  onDelete?: (cardId: string) => void;
}

// ============================================================================
// Card Thumbnail Component
// ============================================================================

interface CardThumbnailProps {
  card: CardType;
  onRefresh?: (cardId: string) => void;
  onDelete?: (cardId: string) => void;
  onClick?: () => void;
  tabIndex?: number;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}

function CardThumbnail({
  card,
  onRefresh,
  onDelete,
  onClick,
  tabIndex = 0,
  onKeyDown,
  itemRef,
}: CardThumbnailProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  // Format currency
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Get image URL (placeholder for now - will need S3 presigned URL logic)
  const imageUrl = imageError
    ? '/placeholder-card.png'
    : getCardImageUrl(card.cardId);

  // Handle keyboard activation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
    onKeyDown?.(event);
  };

  return (
    <div
      ref={itemRef}
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex}
      role="button"
      aria-label={`View details for ${card.name || 'Unknown Card'}`}
    >
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
        {/* Card Image */}
        <div className="relative aspect-[2.5/3.5] bg-[var(--muted)]">
          <Image
            src={imageUrl}
            alt={getCardThumbnailAlt(card)}
            fill
            sizes={getCardImageSizes('thumbnail')}
            className="object-cover"
            onError={() => setImageError(true)}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            quality={75}
          />

          {/* Authenticity Badge Overlay */}
          {card.authenticityScore !== undefined && (
            <div className="absolute top-2 right-2">
              <div
                className={`rounded-full px-2 py-1 text-xs font-medium backdrop-blur-sm ${
                  card.authenticityScore >= 0.8
                    ? 'bg-[var(--emerald-glow)]/80 text-white'
                    : card.authenticityScore >= 0.5
                      ? 'bg-[var(--amber-pulse)]/80 text-white'
                      : 'bg-[var(--crimson-red)]/80 text-white'
                }`}
              >
                {Math.round(card.authenticityScore * 100)}%
              </div>
            </div>
          )}

          {/* Quick Actions Overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefresh?.(card.cardId);
                      }}
                      className="touch-target"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="sr-only">Refresh valuation</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh valuation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(card.cardId);
                      }}
                      className="touch-target"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete card</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete card</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Card Info */}
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate mb-1">
            {card.name || 'Unknown Card'}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] truncate mb-2">
            {card.set || 'Unknown Set'}
            {card.number && ` #${card.number}`}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--vault-blue)]">
              {formatCurrency(card.valueMedian)}
            </span>
            {card.rarity && (
              <span className="text-xs text-[var(--muted-foreground)] capitalize">
                {card.rarity}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[2.5/3.5] w-full rounded-[var(--radius-md)]" />
      <div className="space-y-2 px-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Virtualized Grid Cell Component
// ============================================================================

interface VirtualizedCellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    cards: CardType[];
    columns: number;
    onRefresh?: (cardId: string) => void;
    onDelete?: (cardId: string) => void;
    onCardClick: (cardId: string) => void;
    getTabIndex: (index: number) => number;
    handleKeyDown: (e: React.KeyboardEvent, index: number) => void;
    getItemRef: (index: number) => (el: HTMLDivElement | null) => void;
  };
}

function VirtualizedCell({
  columnIndex,
  rowIndex,
  style,
  data,
}: VirtualizedCellProps) {
  const {
    cards,
    columns,
    onRefresh,
    onDelete,
    onCardClick,
    getTabIndex,
    handleKeyDown,
    getItemRef,
  } = data;

  const index = rowIndex * columns + columnIndex;
  const card = cards[index];

  // Don't render if index is out of bounds
  if (!card) {
    return <div style={style} />;
  }

  return (
    <div style={{ ...style, padding: '8px' }}>
      <CardThumbnail
        card={card}
        onRefresh={onRefresh}
        onDelete={onDelete}
        onClick={() => onCardClick(card.cardId)}
        tabIndex={getTabIndex(index)}
        onKeyDown={(e) => handleKeyDown(e, index)}
        itemRef={getItemRef(index)}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const VIRTUALIZATION_THRESHOLD = 200;
const CARD_HEIGHT = 420; // Approximate card height including padding
const MIN_CARD_WIDTH = 240; // Minimum card width for smaller screens

export function VaultGrid({
  cards,
  isLoading = false,
  onRefresh,
  onDelete,
}: VaultGridProps) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({
    width: 0,
    height: 0,
  });

  // Determine grid columns based on screen size
  const [columns, setColumns] = React.useState(1);

  React.useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1280) setColumns(4);
      else if (width >= 1024) setColumns(3);
      else if (width >= 640) setColumns(2);
      else setColumns(1);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Measure container size for virtualization
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height: Math.max(height, 600) });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Roving tabindex for keyboard navigation
  const { handleKeyDown, getTabIndex, getItemRef } = useRovingTabindex(
    cards.length,
    columns
  );

  // Handle card click navigation
  const handleCardClick = (cardId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/cards/${cardId}` as any);
  };

  // Show loading skeletons
  if (isLoading) {
    return (
      <div className="grid-responsive">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state (should not happen as parent handles this)
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--muted-foreground)]">No cards found</p>
      </div>
    );
  }

  // Use virtualization for large collections (> 200 items)
  const shouldVirtualize = cards.length > VIRTUALIZATION_THRESHOLD;

  if (shouldVirtualize && containerSize.width > 0) {
    // Calculate column width based on container and number of columns
    const columnWidth = Math.max(
      MIN_CARD_WIDTH,
      Math.floor(containerSize.width / columns)
    );
    const rowCount = Math.ceil(cards.length / columns);

    // Prepare data for virtualized cells
    const itemData = {
      cards,
      columns,
      onRefresh,
      onDelete,
      onCardClick: handleCardClick,
      getTabIndex,
      handleKeyDown,
      getItemRef,
    };

    return (
      <div ref={containerRef} className="w-full h-full min-h-[600px]">
        <FixedSizeGrid
          columnCount={columns}
          columnWidth={columnWidth}
          height={containerSize.height}
          rowCount={rowCount}
          rowHeight={CARD_HEIGHT}
          width={containerSize.width}
          itemData={itemData}
          overscanRowCount={2}
          className="scrollbar-thin"
        >
          {VirtualizedCell}
        </FixedSizeGrid>
      </div>
    );
  }

  // Standard rendering for smaller collections
  return (
    <div
      ref={containerRef}
      className="grid-responsive"
      role="grid"
      aria-label="Card collection"
    >
      {cards.map((card, index) => (
        <CardThumbnail
          key={card.cardId}
          card={card}
          onRefresh={onRefresh}
          onDelete={onDelete}
          onClick={() => handleCardClick(card.cardId)}
          tabIndex={getTabIndex(index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          itemRef={getItemRef(index)}
        />
      ))}
    </div>
  );
}
