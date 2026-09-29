export function Progress({ value, indeterminate }: { value?: number; indeterminate?: boolean }) {
  return (
    <div className={['progress', indeterminate ? 'progress--indeterminate' : ''].filter(Boolean).join(' ')}>
      <div className="progress__bar" style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
    </div>
  );
}
