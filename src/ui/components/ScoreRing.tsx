export function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 65 ? 'var(--accent)' : score >= 45 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div
      className="score-ring"
      style={{ ['--score-angle' as string]: `${Math.round((Math.max(0, Math.min(100, score)) / 100) * 360)}deg`, ['--score-color' as string]: color }}
    >
      <span>{Math.round(score)}</span>
    </div>
  );
}
