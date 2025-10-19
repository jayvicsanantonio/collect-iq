'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
  cardId?: string;
  cardName?: string;
}

const FEEDBACK_REASONS = [
  {
    value: 'incorrect_authenticity',
    label: 'Incorrect Authenticity Score',
    description: 'The authenticity score does not match my assessment',
  },
  {
    value: 'false_positive',
    label: 'False Positive (Card is Fake)',
    description: 'The system marked a fake card as authentic',
  },
  {
    value: 'false_negative',
    label: 'False Negative (Card is Real)',
    description: 'The system marked an authentic card as fake',
  },
  {
    value: 'missing_details',
    label: 'Missing Analysis Details',
    description: 'Important authenticity signals were not analyzed',
  },
  {
    value: 'other',
    label: 'Other Issue',
    description: 'Something else is wrong with the analysis',
  },
];

// ============================================================================
// Component
// ============================================================================

export function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  cardName,
}: FeedbackModalProps) {
  const [selectedReason, setSelectedReason] = React.useState<string>('');
  const [details, setDetails] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<
    'idle' | 'success' | 'error'
  >('idle');

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedReason('');
      setDetails('');
      setSubmitStatus('idle');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReason) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      await onSubmit(selectedReason, details);
      setSubmitStatus('success');

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Feedback submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report Incorrect Result</DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues with the authenticity analysis
            {cardName && ` for ${cardName}`}.
          </DialogDescription>
        </DialogHeader>

        {submitStatus === 'success' ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-[var(--emerald-glow)]" />
            <div className="text-center">
              <p className="font-semibold">Thank you for your feedback!</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Your report helps us improve our AI models.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  What&apos;s the issue?
                </label>
                <div className="space-y-2">
                  {FEEDBACK_REASONS.map((reason) => (
                    <button
                      key={reason.value}
                      type="button"
                      onClick={() => handleReasonSelect(reason.value)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedReason === reason.value
                          ? 'border-[var(--vault-blue)] bg-blue-50 dark:bg-blue-950/20'
                          : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
                      }`}
                    >
                      <div className="font-medium text-sm">{reason.label}</div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">
                        {reason.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Details */}
              <div className="space-y-2">
                <label htmlFor="details" className="text-sm font-medium">
                  Additional details (optional)
                </label>
                <textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional context that might help us understand the issue..."
                  className="w-full min-h-[100px] p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  maxLength={500}
                />
                <div className="text-xs text-[var(--muted-foreground)] text-right">
                  {details.length}/500
                </div>
              </div>

              {/* Error Message */}
              {submitStatus === 'error' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-[var(--crimson-red)]">
                  <AlertCircle className="h-4 w-4 text-[var(--crimson-red)] mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-[var(--crimson-red)]">
                      Submission failed
                    </p>
                    <p className="text-[var(--muted-foreground)] mt-1">
                      Please try again or contact support if the issue persists.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedReason || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
