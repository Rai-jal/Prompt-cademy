'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { Settings, Key, TrendingUp, Shield, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type APIKey = {
  id: string;
  provider: string;
  key_name: string;
  encrypted_key: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

type UsageQuota = {
  plan_type: string;
  monthly_token_limit: number;
  monthly_cost_limit: number;
  tokens_used_this_month: number;
  cost_used_this_month: number;
  quota_reset_date: string;
};

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [quota, setQuota] = useState<UsageQuota | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [newKey, setNewKey] = useState({
    provider: 'openai',
    key_name: '',
    key: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadSettings = useCallback(async () => {
    try {
      const [keysRes, quotaRes] = await Promise.all([
        supabase.from('user_api_keys').select('*').eq('user_id', user!.id),
        supabase.from('usage_quotas').select('*').eq('user_id', user!.id).single(),
      ]);

      if (keysRes.data) setApiKeys(keysRes.data);
      if (quotaRes.data) setQuota(quotaRes.data);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user, loadSettings]);

  const addAPIKey = async () => {
    if (!newKey.key_name || !newKey.key) {
      toast({
        title: 'Error',
        description: 'Name and key are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('user_api_keys').insert({
        user_id: user!.id,
        provider: newKey.provider,
        key_name: newKey.key_name,
        encrypted_key: btoa(newKey.key),
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'API key added successfully',
      });

      setAddKeyOpen(false);
      setNewKey({ provider: 'openai', key_name: '', key: '' });
      loadSettings();
    } catch (error: any) {
      console.error('Error adding API key:', error);
      if (error.code === '23505') {
        toast({
          title: 'Error',
          description: 'You already have a key for this provider',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add API key',
          variant: 'destructive',
        });
      }
    }
  };

  const deleteAPIKey = async (keyId: string) => {
    try {
      const { error } = await supabase.from('user_api_keys').delete().eq('id', keyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'API key deleted successfully',
      });
      loadSettings();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive',
      });
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  const getProviderIcon = (provider: string) => {
    return '🔑';
  };

  const getResetDate = (date: string) => {
    const resetDate = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your API keys and usage quotas</p>
        </div>

        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="usage">Usage & Quotas</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage your API keys for different AI providers
                    </CardDescription>
                  </div>
                  <Dialog open={addKeyOpen} onOpenChange={setAddKeyOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add API Key</DialogTitle>
                        <DialogDescription>
                          Add an API key for an AI provider
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="provider">Provider</Label>
                          <select
                            id="provider"
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                            value={newKey.provider}
                            onChange={(e) =>
                              setNewKey({ ...newKey, provider: e.target.value })
                            }
                          >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="google">Google</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="key_name">Key Name</Label>
                          <Input
                            id="key_name"
                            placeholder="My OpenAI Key"
                            value={newKey.key_name}
                            onChange={(e) =>
                              setNewKey({ ...newKey, key_name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="key">API Key</Label>
                          <Input
                            id="key"
                            type="password"
                            placeholder="sk-..."
                            value={newKey.key}
                            onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                          />
                        </div>
                        <Button onClick={addAPIKey} className="w-full">
                          Add Key
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No API keys configured</p>
                    <Button onClick={() => setAddKeyOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <Card key={key.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="text-2xl">{getProviderIcon(key.provider)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">{key.key_name}</p>
                                  <Badge variant="outline">{key.provider}</Badge>
                                  {key.is_active ? (
                                    <Badge className="bg-green-600">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {showKeys[key.id]
                                      ? atob(key.encrypted_key)
                                      : maskKey(atob(key.encrypted_key))}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleKeyVisibility(key.id)}
                                  >
                                    {showKeys[key.id] ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Added {new Date(key.created_at).toLocaleDateString()}
                                  {key.last_used_at &&
                                    ` • Last used ${new Date(
                                      key.last_used_at
                                    ).toLocaleDateString()}`}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteAPIKey(key.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            {quota && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Current Plan</span>
                      <Badge className="text-lg">{quota.plan_type.toUpperCase()}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Your usage limits and remaining quota
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Token Usage</Label>
                        <span className="text-sm text-muted-foreground">
                          {quota.tokens_used_this_month.toLocaleString()} /{' '}
                          {quota.monthly_token_limit.toLocaleString()}
                        </span>
                      </div>
                      <Progress
                        value={(quota.tokens_used_this_month / quota.monthly_token_limit) * 100}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Cost Usage</Label>
                        <span className="text-sm text-muted-foreground">
                          ${quota.cost_used_this_month.toFixed(2)} / $
                          {quota.monthly_cost_limit.toFixed(2)}
                        </span>
                      </div>
                      <Progress
                        value={(Number(quota.cost_used_this_month) / Number(quota.monthly_cost_limit)) * 100}
                      />
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Quota resets in:</span>
                        <span className="font-medium">
                          {getResetDate(quota.quota_reset_date)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Upgrade Plan</CardTitle>
                    <CardDescription>Get more tokens and features</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border-2">
                        <CardHeader>
                          <CardTitle>Free</CardTitle>
                          <div className="text-3xl font-bold">$0</div>
                          <CardDescription>per month</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li>✓ 100K tokens/month</li>
                            <li>✓ $10 usage limit</li>
                            <li>✓ Basic features</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-primary">
                        <CardHeader>
                          <CardTitle>Pro</CardTitle>
                          <div className="text-3xl font-bold">$29</div>
                          <CardDescription>per month</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li>✓ 1M tokens/month</li>
                            <li>✓ $100 usage limit</li>
                            <li>✓ All features</li>
                            <li>✓ Priority support</li>
                          </ul>
                          <Button className="w-full mt-4">Upgrade</Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2">
                        <CardHeader>
                          <CardTitle>Enterprise</CardTitle>
                          <div className="text-3xl font-bold">Custom</div>
                          <CardDescription>Contact us</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li>✓ Unlimited tokens</li>
                            <li>✓ Custom limits</li>
                            <li>✓ Team features</li>
                            <li>✓ Dedicated support</li>
                          </ul>
                          <Button variant="outline" className="w-full mt-4">
                            Contact Sales
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
