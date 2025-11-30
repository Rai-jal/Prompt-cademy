'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase, Course } from '@/lib/supabase';
import { BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

type CourseWithProgress = Course & {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

export default function CoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<string>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadCourses = useCallback(async () => {
    try {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('order_index');

      const { data: progressData } = await supabase
        .from('user_progress')
        .select('lesson_id, status')
        .eq('user_id', user!.id);

      const coursesWithProgress: CourseWithProgress[] = await Promise.all(
        (coursesData || []).map(async (course) => {
          const { data: lessonsData } = await supabase
            .from('lessons')
            .select('id')
            .eq('course_id', course.id);

          const totalLessons = lessonsData?.length || 0;
          const completedLessons = lessonsData?.filter((lesson) =>
            progressData?.some(
              (p) => p.lesson_id === lesson.id && p.status === 'completed'
            )
          ).length || 0;

          const progressPercent = totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

          return {
            ...course,
            totalLessons,
            completedLessons,
            progressPercent,
          };
        })
      );

      setCourses(coursesWithProgress);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user, loadCourses]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredCourses =
    selectedGoal === 'all' ? courses : courses.filter((c) => c.goal === selectedGoal);

  const goals = ['all', 'general', 'writing', 'coding', 'design', 'research'];

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">All Courses</h1>
          <p className="text-muted-foreground">
            Explore courses and start your prompt engineering journey
          </p>
        </div>

        <Tabs value={selectedGoal} onValueChange={setSelectedGoal}>
          <TabsList>
            {goals.map((goal) => (
              <TabsTrigger key={goal} value={goal} className="capitalize">
                {goal}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedGoal} className="mt-6">
            {filteredCourses.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                  <p className="text-muted-foreground">
                    Try selecting a different category
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {filteredCourses.map((course) => (
                  <Card
                    key={course.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-xl">{course.title}</CardTitle>
                            {course.progressPercent === 100 && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                          <CardDescription className="mt-2">
                            {course.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full capitalize">
                          {course.difficulty}
                        </div>
                        <div className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full capitalize">
                          {course.goal}
                        </div>
                        <div className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                          {course.totalLessons} lessons
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {course.progressPercent > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {course.completedLessons} / {course.totalLessons} completed
                            </span>
                          </div>
                          <Progress value={course.progressPercent} className="h-2" />
                        </div>
                      )}
                      <Link href={`/courses/${course.id}`}>
                        <Button className="w-full gap-2">
                          {course.progressPercent === 0
                            ? 'Start Course'
                            : course.progressPercent === 100
                            ? 'Review Course'
                            : 'Continue Course'}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
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
