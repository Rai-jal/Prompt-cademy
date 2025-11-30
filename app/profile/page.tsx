'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as UIBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { Trophy, Award, Target, TrendingUp, Clock, Calendar, Sparkles, Users, UserPlus } from 'lucide-react';
import Link from 'next/link';

type Badge = {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  rarity: string;
  earned_at: string;
};

type Activity = {
  id: string;
  type: 'lesson' | 'challenge';
  title: string;
  score: number;
  completed_at: string;
};

type Stats = {
  total_lessons: number;
  total_challenges: number;
  average_lesson_score: number;
  average_challenge_score: number;
  total_badges: number;
  total_attempts: number;
  total_time_spent: number;
};

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadProfileData = useCallback(async () => {
    try {
      const { data: badgesData } = await supabase
        .from('user_badges')
        .select(`
          badge_id,
          earned_at,
          badges (
            id,
            name,
            description,
            icon_url,
            rarity
          )
        `)
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false });

      const earnedBadges = (badgesData || []).map((ub: any) => ({
        id: ub.badges.id,
        name: ub.badges.name,
        description: ub.badges.description,
        icon_url: ub.badges.icon_url,
        rarity: ub.badges.rarity,
        earned_at: ub.earned_at,
      }));

      setBadges(earnedBadges);

      const { data: lessonsData } = await supabase
        .from('user_progress')
        .select('lesson_id, best_score, completed_at, lessons(title)')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      const { data: challengesData } = await supabase
        .from('challenge_submissions')
        .select('challenge_id, score, scored_at, challenges(title)')
        .eq('user_id', user!.id)
        .eq('status', 'scored')
        .order('scored_at', { ascending: false })
        .limit(5);

      const activities: Activity[] = [];

      (lessonsData || []).forEach((lesson: any) => {
        if (lesson.completed_at && lesson.lessons) {
          activities.push({
            id: lesson.lesson_id,
            type: 'lesson',
            title: lesson.lessons.title,
            score: lesson.best_score,
            completed_at: lesson.completed_at,
          });
        }
      });

      (challengesData || []).forEach((challenge: any) => {
        if (challenge.scored_at && challenge.challenges) {
          activities.push({
            id: challenge.challenge_id,
            type: 'challenge',
            title: challenge.challenges.title,
            score: challenge.score,
            completed_at: challenge.scored_at,
          });
        }
      });

      activities.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
      setRecentActivity(activities.slice(0, 10));

      const { data: statsData } = await supabase.rpc('get_user_stats', { user_uuid: user!.id });

      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      } else {
        setStats({
          total_lessons: 0,
          total_challenges: 0,
          average_lesson_score: 0,
          average_challenge_score: 0,
          total_badges: earnedBadges.length,
          total_attempts: 0,
          total_time_spent: 0,
        });
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user, loadProfileData]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-gradient-to-br from-yellow-400 to-orange-500';
      case 'epic':
        return 'bg-gradient-to-br from-purple-400 to-pink-500';
      case 'rare':
        return 'bg-gradient-to-br from-blue-400 to-cyan-500';
      default:
        return 'bg-gradient-to-br from-gray-300 to-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {getInitials(profile?.full_name || null, profile?.email || '')}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">
                  {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                </h1>
                <p className="text-muted-foreground mb-4">{profile?.email}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <UIBadge variant="secondary" className="capitalize">
                    {profile?.skill_level || 'beginner'}
                  </UIBadge>
                  {profile?.goals && profile.goals.length > 0 && (
                    <>
                      {profile.goals.map((goal: string) => (
                        <UIBadge key={goal} variant="outline" className="capitalize">
                          {goal}
                        </UIBadge>
                      ))}
                    </>
                  )}
                </div>

                {profile?.bio && <p className="text-sm">{profile.bio}</p>}
              </div>

              <Link href="/leaderboard">
                <Button variant="outline" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Lessons</span>
              </div>
              <div className="text-2xl font-bold">{stats?.total_lessons || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {stats?.average_lesson_score || 0}/100
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Challenges</span>
              </div>
              <div className="text-2xl font-bold">{stats?.total_challenges || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {stats?.average_challenge_score || 0}/100
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Badges</span>
              </div>
              <div className="text-2xl font-bold">{badges.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Earned</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Followers</span>
              </div>
              <div className="text-2xl font-bold">{profile?.followers_count || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Following you</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Following</span>
              </div>
              <div className="text-2xl font-bold">{profile?.following_count || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">You follow</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Attempts</span>
              </div>
              <div className="text-2xl font-bold">{stats?.total_attempts || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Total prompts</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="badges">
          <TabsList>
            <TabsTrigger value="badges">
              <Award className="h-4 w-4 mr-2" />
              Badges ({badges.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Clock className="h-4 w-4 mr-2" />
              Recent Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="mt-6">
            {badges.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Award className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Badges Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete lessons and challenges to earn badges!
                  </p>
                  <Link href="/courses">
                    <Button>Start Learning</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {badges.map((badge) => (
                  <Card key={badge.id} className="overflow-hidden">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className={`h-16 w-16 rounded-full ${getRarityColor(badge.rarity)} flex items-center justify-center`}>
                          <Award className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">{badge.name}</h3>
                          <p className="text-xs text-muted-foreground mb-2">{badge.description}</p>
                          <UIBadge variant="outline" className="text-xs capitalize">
                            {badge.rarity}
                          </UIBadge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(badge.earned_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            {recentActivity.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
                  <p className="text-muted-foreground mb-4">Start completing lessons and challenges!</p>
                  <Link href="/courses">
                    <Button>Browse Courses</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {activity.type === 'lesson' ? (
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Trophy className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{activity.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(activity.completed_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{activity.score}</div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
