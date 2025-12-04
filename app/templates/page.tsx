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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { FileText, Plus, Copy, Trash2, Share2, Lock, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AI_MODELS } from '@/lib/ai-models';

type PromptTemplate = {
  id: string;
  creator_id: string;
  title: string;
  content: string;
  description: string | null;
  tags: string[];
  model_recommendation: string;
  is_public: boolean;
  created_at: string;
};

export default function TemplatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [myTemplates, setMyTemplates] = useState<PromptTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<PromptTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const createEmptyTemplate = () => ({
    title: '',
    content: '',
    description: '',
    tags: '',
    model_recommendation: 'gpt-4o',
    is_public: false,
  });
  const [templateForm, setTemplateForm] = useState(createEmptyTemplate);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadTemplates = useCallback(async () => {
    try {
      const { data: myData } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('creator_id', user!.id)
        .order('created_at', { ascending: false });

      const { data: publicData } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_public', true)
        .neq('creator_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setMyTemplates(myData || []);
      setPublicTemplates(publicData || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user, loadTemplates]);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTemplateId(null);
    setTemplateForm(createEmptyTemplate());
  };

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      handleDialogClose();
    } else {
      setIsDialogOpen(true);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplateId(null);
    setTemplateForm(createEmptyTemplate());
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: PromptTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      title: template.title,
      content: template.content,
      description: template.description || '',
      tags: template.tags?.join(', ') || '',
      model_recommendation: template.model_recommendation || 'gpt-4o',
      is_public: template.is_public,
    });
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        title: templateForm.title,
        content: templateForm.content,
        description: templateForm.description || null,
        tags: templateForm.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        model_recommendation: templateForm.model_recommendation,
        is_public: templateForm.is_public,
      };

      if (editingTemplateId) {
        const { error } = await supabase
          .from('prompt_templates')
          .update(payload)
          .eq('id', editingTemplateId)
          .eq('creator_id', user!.id);

        if (error) throw error;

        toast({
          title: 'Template updated',
          description: 'Your prompt template has been updated successfully.',
        });
      } else {
        const { error } = await supabase.from('prompt_templates').insert([
          {
            ...payload,
            creator_id: user!.id,
          },
        ]);

        if (error) throw error;

        toast({
          title: 'Template saved',
          description: 'Your prompt template has been saved successfully.',
        });
      }

      handleDialogClose();
      loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCopyTemplate = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'Template copied to clipboard.',
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const { error } = await supabase.from('prompt_templates').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Template deleted',
        description: 'Your template has been deleted.',
      });

      loadTemplates();
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

  const TemplateCard = ({ template, canDelete }: { template: PromptTemplate; canDelete: boolean }) => {
    const modelLabel = AI_MODELS[template.model_recommendation]?.name ?? template.model_recommendation;
    return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{template.title}</CardTitle>
            {template.description && (
              <CardDescription className="mt-1">{template.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            {template.is_public ? (
              <Share2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-mono whitespace-pre-wrap">{template.content}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {template.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
          <Badge variant="outline">{modelLabel}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleCopyTemplate(template.content)}
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          {canDelete && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openEditDialog(template)}
              >
                <Edit className="h-3 w-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => handleDeleteTemplate(template.id)}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Prompt Templates
            </h1>
            <p className="text-muted-foreground">
              Save and reuse your best prompts
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplateId ? 'Edit Prompt Template' : 'Create Prompt Template'}
                </DialogTitle>
                <DialogDescription>
                  Save a prompt for reuse across projects
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                    placeholder="e.g., Blog Post Outline"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Prompt</Label>
                  <Textarea
                    id="content"
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    placeholder="Your prompt template..."
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={templateForm.description}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, description: e.target.value })
                    }
                    placeholder="What does this prompt do?"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={templateForm.tags}
                    onChange={(e) => setTemplateForm({ ...templateForm, tags: e.target.value })}
                    placeholder="e.g., writing, blog, marketing"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Recommended Model</Label>
                  <Select
                    value={templateForm.model_recommendation}
                    onValueChange={(value) =>
                      setTemplateForm({ ...templateForm, model_recommendation: value })
                    }
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AI_MODELS).map(([key, model]) => (
                        <SelectItem key={key} value={key}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={templateForm.is_public}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, is_public: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_public">Make this template public</Label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit">
                    {editingTemplateId ? 'Update Template' : 'Save Template'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="my-templates">
          <TabsList>
            <TabsTrigger value="my-templates">My Templates ({myTemplates.length})</TabsTrigger>
            <TabsTrigger value="community">Community ({publicTemplates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="my-templates" className="mt-6">
            {myTemplates.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first prompt template to get started
                  </p>
                  <Button onClick={openCreateDialog}>Create Template</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} canDelete={true} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="mt-6">
            {publicTemplates.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No community templates</h3>
                  <p className="text-muted-foreground">
                    Be the first to share a public template!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {publicTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} canDelete={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
