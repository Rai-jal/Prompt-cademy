'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { History, Download, Search, Filter, Calendar, Sparkles, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PromptAttempt = {
  id: string;
  prompt_text: string;
  model: string;
  model_response: string;
  score: number;
  tokens_used: number;
  cost_estimate: number;
  created_at: string;
  lessons?: { title: string } | null;
};

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [attempts, setAttempts] = useState<PromptAttempt[]>([]);
  const [filteredAttempts, setFilteredAttempts] = useState<PromptAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('prompt_attempts')
        .select(`
          *,
          lessons (title)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setAttempts(data || []);
    } catch (error: any) {
      console.error('Error loading history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load prompt history',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  }, [toast, user]);

  const filterAttempts = useCallback(() => {
    let filtered = [...attempts];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.prompt_text.toLowerCase().includes(query) ||
          a.model_response?.toLowerCase().includes(query)
      );
    }

    if (modelFilter !== 'all') {
      filtered = filtered.filter((a) => a.model === modelFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter((a) => new Date(a.created_at) >= filterDate);
    }

    setFilteredAttempts(filtered);
  }, [attempts, dateFilter, modelFilter, searchQuery]);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, loadHistory]);

  useEffect(() => {
    filterAttempts();
  }, [filterAttempts]);

  const handleExport = () => {
    const exportData = filteredAttempts.map((attempt) => ({
      date: new Date(attempt.created_at).toLocaleString(),
      model: attempt.model,
      prompt: attempt.prompt_text,
      response: attempt.model_response || '',
      score: attempt.score,
      tokens: attempt.tokens_used,
      cost: attempt.cost_estimate,
      lesson: attempt.lessons?.title || 'N/A',
    }));

    const csv = [
      ['Date', 'Model', 'Prompt', 'Response', 'Score', 'Tokens', 'Cost', 'Lesson'],
      ...exportData.map((row) =>
        [
          row.date,
          row.model,
          `"${row.prompt.replace(/"/g, '""')}"`,
          `"${row.response.replace(/"/g, '""')}"`,
          row.score,
          row.tokens,
          row.cost,
          row.lesson,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptcademy-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export successful',
      description: `Exported ${filteredAttempts.length} prompts to CSV`,
    });
  };

  const handleExportJSON = () => {
    const exportData = filteredAttempts.map((attempt) => ({
      id: attempt.id,
      date: attempt.created_at,
      model: attempt.model,
      prompt: attempt.prompt_text,
      response: attempt.model_response,
      score: attempt.score,
      tokens_used: attempt.tokens_used,
      cost_estimate: attempt.cost_estimate,
      lesson: attempt.lessons?.title || null,
    }));

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptcademy-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export successful',
      description: `Exported ${filteredAttempts.length} prompts to JSON`,
    });
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const uniqueModels = Array.from(new Set(attempts.map((a) => a.model)));
  const totalCost = filteredAttempts.reduce((sum, a) => sum + a.cost_estimate, 0);
  const totalTokens = filteredAttempts.reduce((sum, a) => sum + a.tokens_used, 0);

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <History className="h-8 w-8 text-primary" />
              Prompt History
            </h1>
            <p className="text-muted-foreground">
              View and export your past prompt attempts
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportJSON} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Prompts</span>
              </div>
              <div className="text-2xl font-bold">{filteredAttempts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Cost</span>
              </div>
              <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Tokens</span>
              </div>
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </label>
                <Input
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Model
                </label>
                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {uniqueModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Range
                </label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Past Week</SelectItem>
                    <SelectItem value="month">Past Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredAttempts.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">No prompts found</h3>
              <p className="text-muted-foreground">
                {attempts.length === 0
                  ? 'Start using the playground to see your history here'
                  : 'Try adjusting your filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAttempts.map((attempt) => (
              <Card key={attempt.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium mb-1 truncate">
                          {attempt.prompt_text}
                        </div>
                        {attempt.lessons && (
                          <div className="text-xs text-muted-foreground">
                            Lesson: {attempt.lessons.title}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Badge variant="outline">{attempt.model}</Badge>
                        {attempt.score > 0 && (
                          <Badge variant="secondary">{attempt.score}/100</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(attempt.created_at).toLocaleDateString()}
                      </span>
                      <span>{attempt.tokens_used} tokens</span>
                      <span>${attempt.cost_estimate.toFixed(4)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
