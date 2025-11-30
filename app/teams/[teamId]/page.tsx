'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Settings, Crown, Shield, User, Activity, FileText, Copy, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type Team = {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  plan: string;
  created_at: string;
};

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
};

type TeamTemplate = {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  category: string;
  version: number;
  usage_count: number;
  created_by: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
};

type TeamActivity = {
  id: string;
  action: string;
  resource_type: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
};

export default function TeamWorkspacePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loadingData, setLoadingData] = useState(true);

  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    description: '',
    content: '',
    tags: '',
    category: 'general',
  });

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadTeamData = useCallback(async () => {
    try {
      const [teamRes, membersRes, templatesRes, activityRes] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('team_members')
          .select('*, profiles(full_name, email)')
          .eq('team_id', teamId),
        supabase
          .from('team_templates')
          .select('*, profiles(full_name)')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('team_activity')
          .select('*, profiles(full_name)')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (teamRes.data) setTeam(teamRes.data);
      if (membersRes.data) {
        setMembers(membersRes.data as TeamMember[]);
        const currentMember = membersRes.data.find((m: any) => m.user_id === user!.id);
        if (currentMember) setUserRole(currentMember.role);
      }
      if (templatesRes.data) setTemplates(templatesRes.data as TeamTemplate[]);
      if (activityRes.data) setActivity(activityRes.data as TeamActivity[]);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team data',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  }, [teamId, toast, user]);

  useEffect(() => {
    if (user && teamId) {
      loadTeamData();
    }
  }, [user, teamId, loadTeamData]);

  const createTemplate = async () => {
    if (!newTemplate.title || !newTemplate.content) {
      toast({
        title: 'Error',
        description: 'Title and content are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('team_templates').insert({
        team_id: teamId,
        created_by: user!.id,
        title: newTemplate.title,
        description: newTemplate.description,
        content: newTemplate.content,
        tags: newTemplate.tags.split(',').map((t) => t.trim()).filter(Boolean),
        category: newTemplate.category,
      });

      if (error) throw error;

      await supabase.rpc('log_team_activity', {
        p_team_id: teamId,
        p_user_id: user!.id,
        p_action: 'template_created',
        p_resource_type: 'template',
        p_metadata: { title: newTemplate.title },
      });

      toast({
        title: 'Success',
        description: 'Template created successfully',
      });

      setCreateTemplateOpen(false);
      setNewTemplate({ title: '', description: '', content: '', tags: '', category: 'general' });
      loadTeamData();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create template',
        variant: 'destructive',
      });
    }
  };

  const copyTemplate = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied',
      description: 'Template copied to clipboard',
    });
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('team_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      loadTeamData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail) {
      toast({
        title: 'Error',
        description: 'Email is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .single();

      if (!userProfile) {
        toast({
          title: 'Error',
          description: 'User not found with that email',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: userProfile.id,
        role: 'member',
      });

      if (error) throw error;

      await supabase.rpc('notify_team_members', {
        p_team_id: teamId,
        p_notification_type: 'team_invite',
        p_title: 'Added to Team',
        p_message: `You've been added to ${team?.name}`,
        p_link: `/teams/${teamId}`,
      });

      toast({
        title: 'Success',
        description: 'Member invited successfully',
      });
      setInviteDialogOpen(false);
      setInviteEmail('');
      loadTeamData();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      if (error.code === '23505') {
        toast({
          title: 'Error',
          description: 'User is already a member',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to invite member',
          variant: 'destructive',
        });
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const canManage = userRole === 'owner' || userRole === 'admin';

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <SidebarLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Team not found</h2>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              {team.name}
            </h1>
            <p className="text-muted-foreground">{team.description}</p>
          </div>
          {canManage && (
            <Link href={`/teams/${teamId}/settings`}>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Members</span>
              </div>
              <div className="text-2xl font-bold">{members.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Templates</span>
              </div>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Activity</span>
              </div>
              <div className="text-2xl font-bold">{activity.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Team Templates</h3>
              <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Team Template</DialogTitle>
                    <DialogDescription>
                      Create a shared template for your team
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newTemplate.title}
                        onChange={(e) =>
                          setNewTemplate({ ...newTemplate, title: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={newTemplate.description}
                        onChange={(e) =>
                          setNewTemplate({ ...newTemplate, description: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="content">Prompt Content</Label>
                      <Textarea
                        id="content"
                        rows={6}
                        value={newTemplate.content}
                        onChange={(e) =>
                          setNewTemplate({ ...newTemplate, content: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        placeholder="marketing, sales, email"
                        value={newTemplate.tags}
                        onChange={(e) =>
                          setNewTemplate({ ...newTemplate, tags: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={newTemplate.category}
                        onValueChange={(value) =>
                          setNewTemplate({ ...newTemplate, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="coding">Coding</SelectItem>
                          <SelectItem value="writing">Writing</SelectItem>
                          <SelectItem value="research">Research</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={createTemplate} className="w-full">
                      Create Template
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {templates.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No templates yet</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {template.description}
                          </CardDescription>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{template.category}</Badge>
                            {template.tags.map((tag, i) => (
                              <Badge key={i} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            by {template.profiles.full_name} • v{template.version} • used{' '}
                            {template.usage_count} times
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyTemplate(template.content)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {(canManage || template.created_by === user!.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{template.content}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Team Members</h3>
              {canManage && (
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Enter the email address of the user you want to invite
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <Button onClick={inviteMember} className="w-full">
                        Send Invite
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid gap-4">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {member.profiles.full_name?.slice(0, 2).toUpperCase() ||
                              member.profiles.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.profiles.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.profiles.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            member.role === 'owner' ? 'default' : 'secondary'
                          }
                          className="flex items-center gap-1"
                        >
                          {getRoleIcon(member.role)}
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            {activity.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No activity yet</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activity.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <Activity className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{item.profiles.full_name}</span>{' '}
                            {item.action.replace('_', ' ')}
                            {item.resource_type && (
                              <span className="text-muted-foreground">
                                {' '}
                                {item.resource_type}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
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
