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
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function EditLessonPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [examplePrompts, setExamplePrompts] = useState<string[]>(['']);
  const [hints, setHints] = useState<string[]>(['']);
  const [estimatedDuration, setEstimatedDuration] = useState(15);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile && profile.role !== 'admin' && profile.role !== 'teacher') {
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  const loadLessonData = useCallback(async () => {
    try {
      const { data: lessonData, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', params.lessonId)
        .single();

      if (error) throw error;

      setTitle(lessonData.title);
      setIntroduction(lessonData.content?.introduction || '');
      setTaskDescription(lessonData.content?.task || '');
      setExamplePrompts(
        lessonData.example_prompts && lessonData.example_prompts.length > 0
          ? lessonData.example_prompts
          : ['']
      );
      setHints(lessonData.hints && lessonData.hints.length > 0 ? lessonData.hints : ['']);
      setEstimatedDuration(lessonData.estimated_duration || 15);
    } catch (error: any) {
      console.error('Error loading lesson:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lesson data',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  }, [params.lessonId, toast]);

  useEffect(() => {
    if (user && profile && (profile.role === 'admin' || profile.role === 'teacher')) {
      loadLessonData();
    }
  }, [user, profile, loadLessonData]);

  const handleAddExample = () => {
    setExamplePrompts([...examplePrompts, '']);
  };

  const handleRemoveExample = (index: number) => {
    setExamplePrompts(examplePrompts.filter((_, i) => i !== index));
  };

  const handleUpdateExample = (index: number, value: string) => {
    const updated = [...examplePrompts];
    updated[index] = value;
    setExamplePrompts(updated);
  };

  const handleAddHint = () => {
    setHints([...hints, '']);
  };

  const handleRemoveHint = (index: number) => {
    setHints(hints.filter((_, i) => i !== index));
  };

  const handleUpdateHint = (index: number, value: string) => {
    const updated = [...hints];
    updated[index] = value;
    setHints(updated);
  };

  const handleSaveLesson = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a lesson title',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const content = {
        introduction: introduction.trim(),
        task: taskDescription.trim(),
      };

      const filteredExamples = examplePrompts.filter((e) => e.trim());
      const filteredHints = hints.filter((h) => h.trim());

      const { error } = await supabase
        .from('lessons')
        .update({
          title: title.trim(),
          content,
          example_prompts: filteredExamples.length > 0 ? filteredExamples : [],
          hints: filteredHints.length > 0 ? filteredHints : [],
          estimated_duration: estimatedDuration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.lessonId);

      if (error) throw error;

      toast({
        title: 'Lesson updated',
        description: 'Your changes have been saved successfully.',
      });

      router.push(`/admin/courses/${params.courseId}`);
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href={`/admin/courses/${params.courseId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Lesson</h1>
            <p className="text-muted-foreground">Update lesson content and details</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lesson Information</CardTitle>
            <CardDescription>Basic details about the lesson</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Lesson Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Introduction to Clear Instructions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Estimated Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 15)}
                min="5"
                max="120"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lesson Content</CardTitle>
            <CardDescription>The main teaching content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="introduction">Introduction</Label>
              <Textarea
                id="introduction"
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="Explain the concept and why it's important..."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task">Task Description</Label>
              <Textarea
                id="task"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe what the student should do in this lesson..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Example Prompts</CardTitle>
                <CardDescription>Good examples to demonstrate the concept</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddExample} className="gap-2">
                <Plus className="h-3 w-3" />
                Add Example
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {examplePrompts.map((example, index) => (
              <div key={index} className="flex gap-2">
                <Textarea
                  value={example}
                  onChange={(e) => handleUpdateExample(index, e.target.value)}
                  placeholder={`Example ${index + 1}`}
                  rows={2}
                />
                {examplePrompts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveExample(index)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hints</CardTitle>
                <CardDescription>Progressive hints to help students</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddHint} className="gap-2">
                <Plus className="h-3 w-3" />
                Add Hint
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {hints.map((hint, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={hint}
                  onChange={(e) => handleUpdateHint(index, e.target.value)}
                  placeholder={`Hint ${index + 1}`}
                />
                {hints.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveHint(index)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleSaveLesson} disabled={saving} size="lg" className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Link href={`/admin/courses/${params.courseId}`}>
            <Button variant="outline" size="lg">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
