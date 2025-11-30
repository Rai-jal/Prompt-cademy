'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type Lesson = {
  id: string;
  title: string;
  order_index: number;
  content: any;
  estimated_duration: number;
};

export default function EditCoursePage({ params }: { params: { courseId: string } }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('general');
  const [difficulty, setDifficulty] = useState('beginner');
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile && profile.role !== 'admin' && profile.role !== 'teacher') {
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  const loadCourseData = useCallback(async () => {
    try {
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', params.courseId)
        .single();

      if (courseError) throw courseError;

      setCourse(courseData);
      setTitle(courseData.title);
      setDescription(courseData.description || '');
      setGoal(courseData.goal);
      setDifficulty(courseData.difficulty || 'beginner');
      setIsPublished(courseData.is_published);

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', params.courseId)
        .order('order_index');

      setLessons(lessonsData || []);
    } catch (error: any) {
      console.error('Error loading course:', error);
      toast({
        title: 'Error',
        description: 'Failed to load course data',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  }, [params.courseId, toast]);

  useEffect(() => {
    if (user && profile && (profile.role === 'admin' || profile.role === 'teacher')) {
      loadCourseData();
    }
  }, [user, profile, loadCourseData]);

  const handleSaveCourse = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          title,
          description,
          goal,
          difficulty,
          is_published: isPublished,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.courseId);

      if (error) throw error;

      toast({
        title: 'Course updated',
        description: 'Your changes have been saved successfully.',
      });

      loadCourseData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return;
    }

    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lessonId);

      if (error) throw error;

      toast({
        title: 'Lesson deleted',
        description: 'The lesson has been successfully deleted.',
      });

      loadCourseData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    return null;
  }

  return (
    <SidebarLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Course</h1>
            <p className="text-muted-foreground">Update course details and manage lessons</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
            <CardDescription>Basic information about your course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter course title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter course description"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal">Goal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger id="goal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="writing">Writing</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="published" className="cursor-pointer">
                Publish this course (visible to users)
              </Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveCourse} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link href="/admin">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lessons</CardTitle>
                <CardDescription>Manage course lessons and their order</CardDescription>
              </div>
              <Link href={`/admin/courses/${params.courseId}/lessons/new`}>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Lesson
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No lessons yet</p>
                <Link href={`/admin/courses/${params.courseId}/lessons/new`}>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Lesson
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <div className="flex-1">
                      <div className="font-medium">{lesson.title}</div>
                      <div className="text-sm text-muted-foreground">
                        Lesson {index + 1} · {lesson.estimated_duration} min
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/admin/courses/${params.courseId}/lessons/${lesson.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteLesson(lesson.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
