'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase, Course, UserProgress } from '@/lib/supabase';
import { BookOpen, Trophy, Target, ArrowRight, Zap, Flame } from 'lucide-react';
import Link from 'next/link';

type CourseWithProgress = Course & {
  totalLessons: number;
  completedLessons: number;
};

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [stats, setStats] = useState({
    totalLessonsCompleted: 0,
    totalAttempts: 0,
    averageScore: 0,
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user && profile && !profile.onboarding_completed) {
      router.push('/onboarding');
    }
  }, [user, profile, loading, router]);

  const loadDashboardData = useCallback(async () => {
    try {
      const userGoals = profile?.goals || [];

      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .in('goal', userGoals.length > 0 ? userGoals : ['general'])
        .eq('is_published', true)
        .order('order_index');

      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user!.id);

      const { data: attemptsData } = await supabase
        .from('prompt_attempts')
        .select('score')
        .eq('user_id', user!.id);

      const coursesWithProgress: CourseWithProgress[] = await Promise.all(
        (coursesData || []).map(async (course) => {
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          const completedLessons = progressData?.filter(
            (p) => p.status === 'completed' && (coursesData || []).some((c) => c.id === course.id)
          ).length || 0;

          return {
            ...course,
            totalLessons: totalLessons || 0,
            completedLessons,
          };
        })
      );

      setCourses(coursesWithProgress);

      const totalCompleted = progressData?.filter((p) => p.status === 'completed').length || 0;
      const totalAttempts = attemptsData?.length || 0;
      const avgScore =
        totalAttempts > 0
          ? Math.round(
              attemptsData!.reduce((sum, a) => sum + a.score, 0) / totalAttempts
            )
          : 0;

      setStats({
        totalLessonsCompleted: totalCompleted,
        totalAttempts: totalAttempts,
        averageScore: avgScore,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [profile, user]);

  useEffect(() => {
    if (user && profile) {
      loadDashboardData();
    }
  }, [user, profile, loadDashboardData]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {profile.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground">
            Continue your journey to mastering prompt engineering
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lessons Completed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLessonsCompleted}</div>
              <p className="text-xs text-muted-foreground">Keep learning!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAttempts}</div>
              <p className="text-xs text-muted-foreground">Practice makes perfect</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageScore}/100</div>
              <p className="text-xs text-muted-foreground">
                {stats.averageScore >= 80 ? 'Excellent!' : 'Keep improving'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Flame className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {profile.current_streak || 0} days
              </div>
              <p className="text-xs text-muted-foreground">
                Longest: {profile.longest_streak || 0} days
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Your Courses</h2>
            <Link href="/courses">
              <Button variant="ghost" className="gap-2">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {courses.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                <p className="text-muted-foreground mb-4">
                  Courses matching your goals will appear here
                </p>
                <Link href="/courses">
                  <Button>Browse All Courses</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {courses.slice(0, 4).map((course) => {
                const progress =
                  course.totalLessons > 0
                    ? Math.round((course.completedLessons / course.totalLessons) * 100)
                    : 0;
                return (
                  <Card key={course.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{course.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {course.description}
                          </CardDescription>
                        </div>
                        <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full capitalize">
                          {course.difficulty}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {course.completedLessons} / {course.totalLessons} lessons
                          </span>
                          <Link href={`/courses/${course.id}`}>
                            <Button size="sm" className="gap-2">
                              {progress > 0 ? 'Continue' : 'Start'}
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
