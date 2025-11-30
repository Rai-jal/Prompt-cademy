'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { Trophy, Clock, Target, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

type Challenge = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  goal: string;
  time_limit_minutes: number | null;
  is_active: boolean;
};

type Submission = {
  challenge_id: string;
  score: number;
  status: string;
  submitted_at: string;
};

export default function ChallengesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadChallenges = useCallback(async () => {
    try {
      const { data: challengesData } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .order('difficulty');

      const { data: submissionsData } = await supabase
        .from('challenge_submissions')
        .select('challenge_id, score, status, submitted_at')
        .eq('user_id', user!.id);

      setChallenges(challengesData || []);
      setSubmissions(submissionsData || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadChallenges();
    }
  }, [user, loadChallenges]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getSubmission = (challengeId: string) => {
    return submissions.find((s) => s.challenge_id === challengeId);
  };

  const activeChallenges = challenges.filter(
    (c) => !getSubmission(c.id) || getSubmission(c.id)!.status === 'pending'
  );
  const completedChallenges = challenges.filter(
    (c) => getSubmission(c.id)?.status === 'scored'
  );

  const ChallengeCard = ({ challenge }: { challenge: Challenge }) => {
    const submission = getSubmission(challenge.id);
    const isCompleted = submission?.status === 'scored';

    return (
      <Card className={isCompleted ? 'border-primary/30 bg-primary/5' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{challenge.title}</CardTitle>
              <CardDescription className="mt-2">{challenge.description}</CardDescription>
            </div>
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-primary" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={challenge.difficulty === 'beginner' ? 'secondary' : challenge.difficulty === 'intermediate' ? 'default' : 'destructive'}>
              {challenge.difficulty}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {challenge.goal}
            </Badge>
            {challenge.time_limit_minutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {challenge.time_limit_minutes} min
              </Badge>
            )}
          </div>

          {isCompleted && submission && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Your Score</span>
                <span className="text-2xl font-bold text-primary">{submission.score}/100</span>
              </div>
            </div>
          )}

          <Link href={`/challenges/${challenge.id}`}>
            <Button className="w-full" variant={isCompleted ? 'outline' : 'default'}>
              {isCompleted ? 'View Submission' : submission ? 'Continue' : 'Start Challenge'}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  };

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Challenges
          </h1>
          <p className="text-muted-foreground">
            Test your prompt engineering skills with real-world challenges
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Available</span>
              </div>
              <div className="text-2xl font-bold">{activeChallenges.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Completed</span>
              </div>
              <div className="text-2xl font-bold">{completedChallenges.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Average Score</span>
              </div>
              <div className="text-2xl font-bold">
                {completedChallenges.length > 0
                  ? Math.round(
                      completedChallenges.reduce((sum, c) => {
                        const sub = getSubmission(c.id);
                        return sum + (sub?.score || 0);
                      }, 0) / completedChallenges.length
                    )
                  : 0}
                /100
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({activeChallenges.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedChallenges.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeChallenges.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground">
                    You&rsquo;ve completed all available challenges. Check back soon for more!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {activeChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completedChallenges.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Completions Yet</h3>
                  <p className="text-muted-foreground">
                    Complete your first challenge to see it here!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {completedChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
