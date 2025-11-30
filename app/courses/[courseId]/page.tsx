'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase, Course, Lesson, UserProgress } from '@/lib/supabase';
import { BookOpen, CheckCircle2, Circle, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type LessonWithProgress = Lesson & {
  progress: UserProgress | null;
};

export default function CoursePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadCourseData = useCallback(async () => {
    try {
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();

      if (!courseData) {
        router.push('/courses');
        return;
      }

      setCourse(courseData);

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user!.id)
        .in(
          'lesson_id',
          lessonsData?.map((l) => l.id) || []
        );

      const lessonsWithProgress: LessonWithProgress[] = (lessonsData || []).map((lesson) => ({
        ...lesson,
        progress: progressData?.find((p) => p.lesson_id === lesson.id) || null,
      }));

      setLessons(lessonsWithProgress);
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoadingData(false);
    }
  }, [courseId, router, user]);

  useEffect(() => {
    if (user && courseId) {
      loadCourseData();
    }
  }, [user, courseId, loadCourseData]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  const completedCount = lessons.filter((l) => l.progress?.status === 'completed').length;
  const progressPercentage =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <div className="flex gap-2 mb-3">
            <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full capitalize">
              {course.difficulty}
            </div>
            <div className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full capitalize">
              {course.goal}
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
          <p className="text-muted-foreground text-lg">{course.description}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Course Progress</span>
              <span className="text-sm font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {completedCount} of {lessons.length} lessons completed
            </p>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-2xl font-bold mb-4">Lessons</h2>
          <div className="space-y-3">
            {lessons.map((lesson, index) => {
              const isCompleted = lesson.progress?.status === 'completed';
              const isInProgress = lesson.progress?.status === 'in_progress';
              const bestScore = lesson.progress?.best_score || 0;

              return (
                <Card
                  key={lesson.id}
                  className={`hover:border-primary/50 transition-colors ${
                    isCompleted ? 'border-primary/30 bg-primary/5' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <CardTitle className="text-lg">
                            Lesson {index + 1}: {lesson.title}
                          </CardTitle>
                          {isCompleted && (
                            <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                              Score: {bestScore}/100
                            </div>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {lesson.estimated_duration} min
                          </span>
                          {isInProgress && (
                            <span className="text-primary font-medium">In Progress</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/courses/${courseId}/lessons/${lesson.id}`}>
                      <Button variant={isCompleted ? 'outline' : 'default'} className="w-full gap-2">
                        {isCompleted ? 'Review' : isInProgress ? 'Continue' : 'Start'} Lesson
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
