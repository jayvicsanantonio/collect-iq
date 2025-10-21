'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
  cardId: string;
}

export interface FeedbackData {
  reason: FeedbackReason;
  details: string;
}

export type FeedbackReason =
  | 'incorrect_authenticity'
  | 'incorrect_valuation'
  | 'incorrect_identification'
  | 'other';

const FEEDBACK_REASONS: Array<{ value: FeedbackReason; label: string }> = [
  { value: 'incorrect_authenticity', label: 'Incorrect Authenticity Score' },
  { value: 'incorrect_valuation', label: 'Incorrect Valuation' },
  { value: 'incorrect_identification', label: 'Incorrect Card Identification' },
  { value: 'other', label: 'Other Issue' },
];

/**
 * FeedbackModal component for reporting incorrect analysis results
 * 
 * This is a future enhancement - the backend endpoint is not yet implemented.
 * The modal collects user feedback about incorrect results and will submit
 * to a feedback endpoint when available.
 */
export function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
}: FeedbackModalProps) {
  const [selectedReason, setSelectedReason] = React.useState<FeedbackReason>(
    'incorrect_authenticity'
  );
  const [details, setDetails] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!details.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        reason: selectedReason,
        details: details.trim(),
      });

      // Reset form
      setSelectedReason('incorrect_authenticity');
      setDetails('');
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('incorrect_authenticity');
      setDetails('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Report Incorrect Result
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting any incorrect analysis results. Your
            feedback will be reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">What&apos;s incorrect?</Label>
            <div className="space-y-2">
              {FEEDBACK_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) =>
                      setSelectedReason(e.target.value as FeedbackReason)
                    }
                    className="w-4 h-4 text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">
              Additional Details <span className="text-[var(--destructive)]">*</span>
            </Label>
            <Textarea
              id="details"
              placeholder="Please describe what's incorrect and what the correct result should be..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              required
              className="resize-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Be as specific as possible to help us improve our analysis.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !details.trim()}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
