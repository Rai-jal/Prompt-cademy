'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { Trophy, Crown, Medal, TrendingUp, Award, Star } from 'lucide-react';

type LeaderboardEntry = {
  user_id: string;
  full_name: string | null;
  email: string;
  total_score: number;
  challenges_completed: number;
  lessons_completed: number;
  badges_earned: number;
  average_score: number;
  rank?: number;
};

export default function LeaderboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [overallLeaderboard, setOverallLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lessonLeaderboard, setLessonLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userStats, setUserStats] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadLeaderboards = useCallback(async () => {
    try {
      const { data: overallData } = await supabase.rpc('get_overall_leaderboard');
      const { data: challengeData } = await supabase.rpc('get_challenge_leaderboard');
      const { data: lessonData } = await supabase.rpc('get_lesson_leaderboard');

      const processedOverall = (overallData || []).map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1,
      }));

      const processedChallenge = (challengeData || []).map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1,
      }));

      const processedLesson = (lessonData || []).map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1,
      }));

      setOverallLeaderboard(processedOverall);
      setChallengeLeaderboard(processedChallenge);
      setLessonLeaderboard(processedLesson);

      const userEntry = processedOverall.find((entry: LeaderboardEntry) => entry.user_id === user!.id);
      if (userEntry) {
        setUserStats(userEntry);
      }
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadLeaderboards();
    }
  }, [user, loadLeaderboards]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-medium w-5 text-center">{rank}</span>;
    }
  };

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

  const LeaderboardTable = ({ entries }: { entries: LeaderboardEntry[] }) => {
    if (entries.length === 0) {
      return (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
            <p className="text-muted-foreground">Complete challenges and lessons to appear on the leaderboard!</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {entries.map((entry) => (
          <Card
            key={entry.user_id}
            className={entry.user_id === user?.id ? 'border-primary/50 bg-primary/5' : ''}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8">{getRankIcon(entry.rank!)}</div>

                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(entry.full_name, entry.email)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {entry.full_name || entry.email.split('@')[0]}
                  </div>
                  {entry.user_id === user?.id && (
                    <Badge variant="secondary" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Lessons</div>
                    <div className="font-semibold">{entry.lessons_completed}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Challenges</div>
                    <div className="font-semibold">{entry.challenges_completed}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Avg Score</div>
                    <div className="font-semibold text-primary">{entry.average_score}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Badges</div>
                    <div className="font-semibold">{entry.badges_earned}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Compete with other learners and climb the ranks
          </p>
        </div>

        {userStats && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Your Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">#{userStats.rank}</div>
                  <div className="text-sm text-muted-foreground">Global Rank</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{userStats.lessons_completed}</div>
                  <div className="text-sm text-muted-foreground">Lessons</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{userStats.challenges_completed}</div>
                  <div className="text-sm text-muted-foreground">Challenges</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{userStats.average_score}</div>
                  <div className="text-sm text-muted-foreground">Avg Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{userStats.badges_earned}</div>
                  <div className="text-sm text-muted-foreground">Badges</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overall">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overall">
              <Trophy className="h-4 w-4 mr-2" />
              Overall
            </TabsTrigger>
            <TabsTrigger value="challenges">
              <Award className="h-4 w-4 mr-2" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="lessons">
              <TrendingUp className="h-4 w-4 mr-2" />
              Lessons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="mt-6">
            <LeaderboardTable entries={overallLeaderboard} />
          </TabsContent>

          <TabsContent value="challenges" className="mt-6">
            <LeaderboardTable entries={challengeLeaderboard} />
          </TabsContent>

          <TabsContent value="lessons" className="mt-6">
            <LeaderboardTable entries={lessonLeaderboard} />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
