import { Alert } from '@chenyibo111/ui';

export type FeedbackNotice = {
  message: string;
  variant: 'info' | 'success' | 'destructive';
};

export function FeedbackAlert({ notice }: { notice: FeedbackNotice | null }) {
  if (!notice) return null;
  return <Alert className="notice" variant={notice.variant} role={notice.variant === 'destructive' ? 'alert' : 'status'}>{notice.message}</Alert>;
}
