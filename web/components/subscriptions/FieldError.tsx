import { cn } from '@/lib/utils';

/** A field's error sentence; the field points at it with `aria-describedby={id}`. */
export function FieldError({
  id,
  children,
  className,
}: {
  id: string;
  children?: string;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} className={cn('m-0 text-sm font-semibold text-danger-ink', className)}>
      {children}
    </p>
  );
}
