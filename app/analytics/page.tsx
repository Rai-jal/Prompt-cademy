'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  DollarSign,
  Zap,
  Award,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadAnalytics = useCallback(async () => {
    try {
      const [attemptsRes, progressRes, badgesRes, profileRes] = await Promise.all([
        supabase
          .from('prompt_attempts')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('user_progress')
          .select('*, lessons(*)')
          .eq('user_id', user!.id),
        supabase
          .from('user_badges')
          .select('*, badges(*)')
          .eq('user_id', user!.id),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user!.id)
          .single(),
      ]);

      const attempts = attemptsRes.data || [];
      const progress = progressRes.data || [];
      const badges = badgesRes.data || [];
      const profile = profileRes.data;

      const modelUsage = attempts.reduce((acc: any, attempt) => {
        acc[attempt.model] = (acc[attempt.model] || 0) + 1;
        return acc;
      }, {});

      const dailyActivity = attempts.reduce((acc: any, attempt) => {
        const date = new Date(attempt.created_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const scoreDistribution = attempts
        .filter((a) => a.score > 0)
        .reduce((acc: any, attempt) => {
          const range = Math.floor(attempt.score / 10) * 10;
          const key = `${range}-${range + 9}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

      const totalCost = attempts.reduce((sum, a) => sum + a.cost_estimate, 0);
      const totalTokens = attempts.reduce((sum, a) => sum + a.tokens_used, 0);
      const avgScore =
        attempts.filter((a) => a.score > 0).length > 0
          ? attempts
              .filter((a) => a.score > 0)
              .reduce((sum, a) => sum + a.score, 0) /
            attempts.filter((a) => a.score > 0).length
          : 0;

      setAnalyticsData({
        attempts,
        progress,
        badges,
        profile,
        modelUsage: Object.entries(modelUsage).map(([name, value]) => ({
          name,
          value,
        })),
        dailyActivity: Object.entries(dailyActivity)
          .slice(-14)
          .map(([date, count]) => ({ date, count })),
        scoreDistribution: Object.entries(scoreDistribution).map(([range, count]) => ({
          range,
          count,
        })),
        summary: {
          totalAttempts: attempts.length,
          totalCost,
          totalTokens,
          avgScore: Math.round(avgScore),
          completedLessons: progress.filter((p: any) => p.status === 'completed').length,
          badgesEarned: badges.length,
          currentStreak: profile?.current_streak || 0,
          longestStreak: profile?.longest_streak || 0,
        },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, loadAnalytics]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analyticsData) return null;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your progress and insights across the platform
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Attempts</span>
              </div>
              <div className="text-2xl font-bold">{analyticsData.summary.totalAttempts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Score</span>
              </div>
              <div className="text-2xl font-bold">{analyticsData.summary.avgScore}/100</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Cost</span>
              </div>
              <div className="text-2xl font-bold">
                ${analyticsData.summary.totalCost.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Badges</span>
              </div>
              <div className="text-2xl font-bold">{analyticsData.summary.badgesEarned}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Activity (Last 14 Days)
                </CardTitle>
                <CardDescription>Your prompt attempts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current Streak</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {analyticsData.summary.currentStreak} days 🔥
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Longest Streak</span>
                      <span className="text-xl font-bold">
                        {analyticsData.summary.longestStreak} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Lessons Completed</span>
                      <span className="text-xl font-bold">
                        {analyticsData.summary.completedLessons}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Tokens</span>
                      <span className="text-xl font-bold">
                        {analyticsData.summary.totalTokens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Avg Tokens/Attempt</span>
                      <span className="text-xl font-bold">
                        {analyticsData.summary.totalAttempts > 0
                          ? Math.round(
                              analyticsData.summary.totalTokens /
                                analyticsData.summary.totalAttempts
                            ).toLocaleString()
                          : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Avg Cost/Attempt</span>
                      <span className="text-xl font-bold">
                        $
                        {analyticsData.summary.totalAttempts > 0
                          ? (
                              analyticsData.summary.totalCost /
                              analyticsData.summary.totalAttempts
                            ).toFixed(4)
                          : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Usage Distribution</CardTitle>
                <CardDescription>Which AI models you use most frequently</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={analyticsData.modelUsage}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analyticsData.modelUsage.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>How your scores are distributed</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
