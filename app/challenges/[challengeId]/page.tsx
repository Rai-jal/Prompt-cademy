'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { runPromptViaApi } from '@/lib/client/ai';
import { ChevronLeft, Clock, Target, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type Challenge = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  goal: string;
  spec: any;
  test_cases: any;
  time_limit_minutes: number | null;
};

export default function ChallengePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const challengeId = params.challengeId as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [promptText, setPromptText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadChallenge = useCallback(async () => {
    try {
      const { data: challengeData } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .maybeSingle();

      if (!challengeData) {
        router.push('/challenges');
        return;
      }

      setChallenge(challengeData);

      const { data: submissionData } = await supabase
        .from('challenge_submissions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (submissionData) {
        setSubmission(submissionData);
        setPromptText(submissionData.prompt_text);
      }
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoadingData(false);
    }
  }, [challengeId, router, user]);

  useEffect(() => {
    if (user && challengeId) {
      loadChallenge();
    }
  }, [user, challengeId, loadChallenge]);

  const handleSubmit = async () => {
    if (!promptText.trim() || !challenge) {
      toast({
        title: 'Empty prompt',
        description: 'Please write your prompt before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await runPromptViaApi(promptText, 'gpt-4o');

      if (result.error) {
        throw new Error(result.error);
      }

      const score = calculateScore(result.response, challenge);

      const submissionData = {
        user_id: user!.id,
        challenge_id: challengeId,
        prompt_text: promptText,
        ai_response: result.response,
        model_used: 'gpt-4o',
        score: score.total,
        score_breakdown: score.breakdown,
        feedback: score.feedback,
        status: 'scored',
        scored_at: new Date().toISOString(),
      };

      if (submission) {
        await supabase
          .from('challenge_submissions')
          .update(submissionData)
          .eq('id', submission.id);
      } else {
        await supabase
          .from('challenge_submissions')
          .insert([submissionData]);
      }

      toast({
        title: 'Challenge submitted!',
        description: `Your score: ${score.total}/100`,
      });

      loadChallenge();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit challenge',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateScore = (response: string, challenge: Challenge) => {
    const breakdown: any = {};
    let total = 0;
    const feedback: string[] = [];

    const criteria = challenge.test_cases?.criteria || {};
    const requirements = challenge.spec?.requirements || [];

    Object.entries(criteria).forEach(([key, value]: [string, any]) => {
      const weight = value.weight || 0;
      let score = Math.floor(Math.random() * (weight * 0.4)) + Math.floor(weight * 0.6);

      const responseLength = response.length;
      if (key.includes('word_count') && responseLength < 200) {
        score = Math.floor(weight * 0.3);
        feedback.push(`Response seems short. Consider providing more detail.`);
      } else if (key.includes('word_count') && responseLength > 2000) {
        score = Math.floor(weight * 0.5);
        feedback.push(`Response is very long. Try to be more concise.`);
      }

      if (key.includes('clarity') || key.includes('explanation')) {
        score = Math.min(weight, Math.floor(weight * (responseLength / 500)));
      }

      requirements.forEach((req: string) => {
        const reqLower = req.toLowerCase();
        if (response.toLowerCase().includes(reqLower.substring(0, 10))) {
          score = Math.min(weight, score + 2);
        }
      });

      breakdown[key] = score;
      total += score;

      if (score < weight * 0.7) {
        feedback.push(`${value.description}: Consider improving this aspect.`);
      }
    });

    if (total >= 90) {
      feedback.unshift('Outstanding work! You exceeded expectations.');
    } else if (total >= 75) {
      feedback.unshift('Great job! Your prompt meets the challenge requirements.');
    } else if (total >= 60) {
      feedback.unshift('Good effort. Review the feedback to improve your score.');
    } else {
      feedback.unshift('Keep practicing. Focus on the requirements below.');
    }

    return { total: Math.min(100, total), breakdown, feedback: feedback.join(' ') };
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!challenge) {
    return null;
  }

  const isCompleted = submission?.status === 'scored';
  const requirements = challenge.spec?.requirements || [];

  return (
    <SidebarLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/challenges">
          <Button variant="ghost" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Challenges
          </Button>
        </Link>

        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge
              variant={
                challenge.difficulty === 'beginner'
                  ? 'secondary'
                  : challenge.difficulty === 'intermediate'
                  ? 'default'
                  : 'destructive'
              }
            >
              {challenge.difficulty}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {challenge.goal}
            </Badge>
            {challenge.time_limit_minutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {challenge.time_limit_minutes} minutes
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
          <p className="text-muted-foreground text-lg">{challenge.description}</p>
        </div>

        {isCompleted && submission && (
          <Alert className="border-primary/50 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium">Challenge Completed!</span>
                <span className="text-2xl font-bold text-primary">{submission.score}/100</span>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Challenge Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requirements.map((req: string, index: number) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-primary font-bold">{index + 1}.</span>
                      <span className="text-sm">{req}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {challenge.spec?.code && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Code to Debug</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto">
                    <code>{challenge.spec.code}</code>
                  </pre>
                  {challenge.spec.error && (
                    <Alert className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Error:</strong> {challenge.spec.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {challenge.spec?.deliverable && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Expected Deliverable</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{challenge.spec.deliverable}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Prompt</CardTitle>
                <CardDescription>
                  Write a prompt that satisfies all requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Write your prompt here..."
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isCompleted}
                />

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !promptText.trim() || isCompleted}
                  className="w-full gap-2"
                >
                  {isSubmitting ? (
                    <>Submitting...</>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Completed
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Challenge
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {isCompleted && submission && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Response</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-sm">{submission.ai_response}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(submission.score_breakdown || {}).map(([key, value]: [string, any]) => {
                      const criteria = challenge.test_cases?.criteria?.[key];
                      return (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="capitalize">
                            {key.replace(/_/g, ' ')}
                            {criteria && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({criteria.weight} max)
                              </span>
                            )}
                          </span>
                          <span className="font-medium">{value}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between text-base font-bold pt-3 border-t">
                      <span>Total Score</span>
                      <span className="text-primary">{submission.score}/100</span>
                    </div>
                  </CardContent>
                </Card>

                {submission.feedback && (
                  <Alert>
                    <AlertDescription className="text-sm">{submission.feedback}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
