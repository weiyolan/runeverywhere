/**
 * Reviews service (P4 H3). submit_review owns the once-per-run +10 and the
 * rating aggregates; the client just renders states.
 */
import { supabase } from '@/lib/supabase';

export const REVIEW_TAGS = [
  'Great pace',
  'Welcoming',
  'On time',
  'Knows the city',
  'Strong runner',
  'Good vibes',
] as const;

export interface CrewMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  isHost: boolean;
  /** The viewer's review of this member, if any. */
  myStars: number | null;
}

export interface SubmitReviewResult {
  review_id: string;
  rate_crew_awarded: boolean;
}

export async function submitReview(args: {
  runId: string;
  revieweeId: string;
  stars: number;
  tags: string[];
  note: string;
}): Promise<SubmitReviewResult> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_run_id: args.runId,
    p_reviewee_id: args.revieweeId,
    p_stars: args.stars,
    p_tags: args.tags,
    p_note: args.note,
  });
  if (error) throw error;
  return data as unknown as SubmitReviewResult;
}

/** Host + approved members minus self, joined with my reviews of them. */
export async function fetchCrew(runId: string): Promise<CrewMember[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error('not signed in');

  const [runRes, membersRes, reviewsRes] = await Promise.all([
    supabase.from('runs').select('host_id, host:profiles!runs_host_id_fkey(id, display_name, avatar_url, rating_avg, rating_count)').eq('id', runId).single(),
    supabase
      .from('run_members')
      .select('user_id, status, profile:profiles!run_members_user_id_fkey(id, display_name, avatar_url, rating_avg, rating_count)')
      .eq('run_id', runId)
      .eq('status', 'approved'),
    supabase.from('reviews').select('reviewee_id, stars').eq('run_id', runId).eq('reviewer_id', uid),
  ]);
  if (runRes.error) throw runRes.error;
  if (membersRes.error) throw membersRes.error;
  if (reviewsRes.error) throw reviewsRes.error;

  const myReviews = new Map(reviewsRes.data.map((r) => [r.reviewee_id, r.stars]));
  const crew: CrewMember[] = [];

  const host = runRes.data.host;
  if (host && host.id !== uid) {
    crew.push({
      user_id: host.id,
      display_name: host.display_name,
      avatar_url: host.avatar_url,
      rating_avg: host.rating_avg,
      rating_count: host.rating_count,
      isHost: true,
      myStars: myReviews.get(host.id) ?? null,
    });
  }
  for (const m of membersRes.data) {
    if (m.user_id === uid || !m.profile) continue;
    crew.push({
      user_id: m.user_id,
      display_name: m.profile.display_name,
      avatar_url: m.profile.avatar_url,
      rating_avg: m.profile.rating_avg,
      rating_count: m.profile.rating_count,
      isHost: false,
      myStars: myReviews.get(m.user_id) ?? null,
    });
  }
  return crew;
}
