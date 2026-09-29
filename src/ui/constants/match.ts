export const MATCH_RECOMMENDATION_LABELS: Record<string, string> = {
  strong_match: 'Strong match',
  good_match: 'Good match',
  stretch: 'Stretch',
  weak_match: 'Weak match',
};

export function recommendationLabel(recommendation: string | undefined): string {
  return MATCH_RECOMMENDATION_LABELS[recommendation ?? ''] ?? 'Match';
}
