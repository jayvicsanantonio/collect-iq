import { useEffect, useRef, useState } from 'react';

/**
 * Hook for implementing roving tabindex pattern for keyboard navigation
 * in grid/list components.
 *
 * This allows users to navigate through items using arrow keys while
 * maintaining only one tab stop in the component.
 *
 * @param itemCount - Total number of items in the grid
 * @param columns - Number of columns in the grid (for arrow key navigation)
 * @returns Object with current focus index and keyboard event handler
 */
export function useRovingTabindex(itemCount: number, columns: number = 1) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, itemCount);
  }, [itemCount]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let newIndex = index;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = Math.min(index + 1, itemCount - 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = Math.max(index - 1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.min(index + columns, itemCount - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.max(index - columns, 0);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = itemCount - 1;
        break;
      default:
        return;
    }

    setFocusedIndex(newIndex);
    itemRefs.current[newIndex]?.focus();
  };

  // Get tabindex for an item
  const getTabIndex = (index: number) => {
    return index === focusedIndex ? 0 : -1;
  };

  // Get ref setter for an item
  const getItemRef = (index: number) => {
    return (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    };
  };

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getTabIndex,
    getItemRef,
  };
}
