/**
 * Toast notification examples and usage patterns
 * This file demonstrates how to use the toast system throughout the application
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { toast, success, error, info, loading, promise } from '@/hooks/use-toast';
import { type ProblemDetails } from '@/lib/types';
import { formatError } from '@/lib/errors';

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Show a simple success message
 */
export function showSuccessToast() {
  success('Card saved to vault successfully!');
}

/**
 * Show a simple error message
 */
export function showErrorToast() {
  error('Failed to upload image. Please try again.');
}

/**
 * Show an info message
 */
export function showInfoToast() {
  info('Valuation data is being refreshed in the background.');
}

// ============================================================================
// Advanced Usage Examples
// ============================================================================

/**
 * Show a toast with custom title
 */
export function showCustomTitleToast() {
  success('Your collection has been updated', 'Success');
}

/**
 * Show a toast with action button
 */
export function showToastWithAction() {
  toast({
    title: 'Card deleted',
    description: 'The card has been removed from your vault.',
    // Note: Action buttons require using ToastAction component
    // See toast.tsx for proper action implementation
  });
}

/**
 * Show a loading toast that doesn't auto-dismiss
 */
export function showLoadingToast() {
  const loadingToast = loading('Analyzing card image...');
  
  // Later, dismiss it manually
  setTimeout(() => {
    loadingToast.dismiss();
    success('Analysis complete!');
  }, 3000);
}

// ============================================================================
// Promise-based Toasts
// ============================================================================

/**
 * Show toast that updates based on promise state
 */
export async function uploadWithToast(file: File) {
  return promise(
    uploadFile(file),
    {
      loading: 'Uploading image...',
      success: 'Image uploaded successfully!',
      error: 'Failed to upload image',
    }
  );
}

/**
 * Show toast with dynamic success message
 */
export async function saveCardWithToast(cardName: string) {
  return promise(
    saveCard(cardName),
    {
      loading: 'Saving card...',
      success: (data) => `${data.name} saved to vault!`,
      error: (err) => {
        if (err instanceof Error) {
          return err.message;
        }
        return 'Failed to save card';
      },
    }
  );
}

// ============================================================================
// Error Handling with ProblemDetails
// ============================================================================

/**
 * Show toast for API error with ProblemDetails
 */
export function showApiErrorToast(problem: ProblemDetails) {
  const formatted = formatError(problem);
  
  error(
    `${formatted.message} ${formatted.remediation}`,
    formatted.title
  );
}

/**
 * Show toast for specific error types
 */
export function showSpecificErrorToast(problem: ProblemDetails) {
  const formatted = formatError(problem);
  
  switch (problem.status) {
    case 413:
      error('Please upload a file under 12 MB', 'File Too Large');
      break;
    case 415:
      error('Please use JPG, PNG, or HEIC format', 'Unsupported File Type');
      break;
    case 429:
      error('Please wait a moment before trying again', 'Rate Limit Exceeded');
      break;
    default:
      error(formatted.message, formatted.title);
  }
}

// ============================================================================
// Common Application Toasts
// ============================================================================

/**
 * Card saved to vault
 */
export function cardSavedToast(cardName: string) {
  success(`${cardName} has been added to your vault`);
}

/**
 * Card deleted from vault
 */
export function cardDeletedToast(cardName: string) {
  success(`${cardName} has been removed from your vault`);
}

/**
 * Valuation refreshed
 */
export function valuationRefreshedToast() {
  success('Valuation data has been updated');
}

/**
 * Upload started
 */
export function uploadStartedToast() {
  info('Uploading image...');
}

/**
 * Upload completed
 */
export function uploadCompletedToast() {
  success('Image uploaded successfully');
}

/**
 * Analysis started
 */
export function analysisStartedToast() {
  info('Analyzing card...');
}

/**
 * Analysis completed
 */
export function analysisCompletedToast() {
  success('Card analysis complete');
}

// ============================================================================
// Mock Functions (for examples)
// ============================================================================

async function uploadFile(_file: File): Promise<{ url: string }> {
  // Mock implementation
  return new Promise((resolve) => {
    setTimeout(() => resolve({ url: 'https://example.com/image.jpg' }), 2000);
  });
}

async function saveCard(cardName: string): Promise<{ name: string }> {
  // Mock implementation
  return new Promise((resolve) => {
    setTimeout(() => resolve({ name: cardName }), 1000);
  });
}
