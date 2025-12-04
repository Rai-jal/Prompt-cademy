'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { AI_MODELS } from '@/lib/ai-models';
import { supabase } from '@/lib/supabase';
import {
  Zap,
  Send,
  Sparkles,
  Clock,
  DollarSign,
  BarChart3,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { compareModelsViaApi } from '@/lib/client/ai';
import type { PromptResult } from '@/types/ai';

const AVAILABLE_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'claude-3-5-sonnet',
  'claude-3-5-haiku',
  'gemini-pro',
  'gemini-flash',
];

const BUDGET_MODELS = ['gpt-4o-mini', 'claude-3-5-haiku', 'gemini-flash'] as const;
const HIGH_COST_WARNING_THRESHOLD = 5; // USD
const MAX_MODELS_BEFORE_RATE_WARNING = 4;
const DAILY_MODEL_CALL_LIMIT = 40;
const DAILY_COST_LIMIT = 25; // USD
const QUOTA_WARNING_RATIO = 0.8;
const DEFAULT_PROMPT_TOKEN_ESTIMATE = 120;

const estimatePromptTokens = (text: string) => {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.max(Math.ceil(words * 1.3), 20);
};

export default function PlaygroundPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([...BUDGET_MODELS]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [results, setResults] = useState<PromptResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [budgetMode, setBudgetMode] = useState(true);
  const [hasAcknowledgedCostRisk, setHasAcknowledgedCostRisk] = useState(false);
  const [usageStats, setUsageStats] = useState({ attemptsToday: 0, costToday: 0 });
  const [usageLoading, setUsageLoading] = useState(false);

  const fetchUsageStats = useCallback(async () => {
    if (!user) return;

    setUsageLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('prompt_attempts')
      .select('cost_estimate, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString());

    if (error) {
      toast({
        title: 'Unable to refresh usage',
        description: error.message,
        variant: 'destructive',
      });
    } else if (data) {
      const costSum = data.reduce((sum, attempt) => sum + (attempt.cost_estimate ?? 0), 0);
      setUsageStats({
        attemptsToday: data.length,
        costToday: costSum,
      });
    }

    setUsageLoading(false);
  }, [toast, user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchUsageStats();
    }
  }, [user, fetchUsageStats]);

  useEffect(() => {
    setHasAcknowledgedCostRisk(false);
  }, [prompt, selectedModels, maxTokens]);

  const costEstimate = useMemo(() => {
    const assumedInputTokens = prompt.trim()
      ? estimatePromptTokens(prompt)
      : DEFAULT_PROMPT_TOKEN_ESTIMATE;

    const breakdown = selectedModels.map((modelKey) => {
      const model = AI_MODELS[modelKey];
      const estimatedCost =
        ((assumedInputTokens || DEFAULT_PROMPT_TOKEN_ESTIMATE) / 1000) * model.costPer1kInput +
        (maxTokens / 1000) * model.costPer1kOutput;
      return {
        modelKey,
        model,
        cost: estimatedCost,
      };
    });

    const estimatedCost = breakdown.reduce((sum, item) => sum + item.cost, 0);

    return {
      breakdown,
      estimatedCost,
      assumedInputTokens,
    };
  }, [prompt, selectedModels, maxTokens]);

  const estimatedCost = costEstimate.estimatedCost;
  const selectedModelCount = selectedModels.length;
  const showHighCostWarning = estimatedCost > HIGH_COST_WARNING_THRESHOLD;
  const showRateLimitWarning = selectedModelCount > MAX_MODELS_BEFORE_RATE_WARNING;
  const needsCostAcknowledgement = showHighCostWarning;
  const costByModel = useMemo(() => {
    const map = new Map<string, number>();
    costEstimate.breakdown.forEach(({ modelKey, cost }) => map.set(modelKey, cost));
    return map;
  }, [costEstimate]);

  const attemptUsagePercent = Math.min(
    (usageStats.attemptsToday / DAILY_MODEL_CALL_LIMIT) * 100,
    100
  );
  const costUsagePercent = Math.min((usageStats.costToday / DAILY_COST_LIMIT) * 100, 100);
  const reachedAttemptLimit = usageStats.attemptsToday >= DAILY_MODEL_CALL_LIMIT;
  const reachedCostLimit = usageStats.costToday >= DAILY_COST_LIMIT;
  const nearAttemptLimit = attemptUsagePercent / 100 >= QUOTA_WARNING_RATIO;
  const nearCostLimit = costUsagePercent / 100 >= QUOTA_WARNING_RATIO;
  const disableRunButton =
    isRunning ||
    !prompt.trim() ||
    selectedModelCount === 0 ||
    (needsCostAcknowledgement && !hasAcknowledgedCostRisk) ||
    reachedAttemptLimit ||
    reachedCostLimit;

  const toggleModel = (modelKey: string) => {
    if (budgetMode && !BUDGET_MODELS.includes(modelKey as (typeof BUDGET_MODELS)[number])) {
      toast({
        title: 'Budget mode enabled',
        description: 'Disable budget mode to try premium models.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedModels((prev) =>
      prev.includes(modelKey) ? prev.filter((m) => m !== modelKey) : [...prev, modelKey]
    );
  };

  const handleBudgetToggle = (checked: boolean) => {
    setBudgetMode(checked);
    if (checked) {
      setSelectedModels([...BUDGET_MODELS]);
      toast({
        title: 'Budget mode on',
        description: 'We selected the most cost-effective models for you.',
      });
    }
  };

  const handleRunPrompt = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Empty prompt',
        description: 'Please enter a prompt to test.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedModels.length === 0) {
      toast({
        title: 'No models selected',
        description: 'Please select at least one model.',
        variant: 'destructive',
      });
      return;
    }

    if (needsCostAcknowledgement && !hasAcknowledgedCostRisk) {
      toast({
        title: 'Confirm high cost run',
        description: 'Please acknowledge the estimated cost before continuing.',
        variant: 'destructive',
      });
      return;
    }

    const projectedModelCalls = usageStats.attemptsToday + selectedModelCount;
    if (projectedModelCalls > DAILY_MODEL_CALL_LIMIT) {
      toast({
        title: 'Daily model call limit reached',
        description: 'Try again tomorrow or reduce the number of models selected.',
        variant: 'destructive',
      });
      return;
    }

    const projectedCost = usageStats.costToday + estimatedCost;
    if (projectedCost > DAILY_COST_LIMIT) {
      toast({
        title: 'Daily budget exceeded',
        description: 'This run would exceed your daily cost allowance.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in again to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      const modelResults = await compareModelsViaApi(
        prompt,
        selectedModels,
        {
          temperature,
          max_tokens: maxTokens,
        }
      );

      setResults(modelResults);

      const payload = modelResults.map((result) => ({
        user_id: user.id,
        prompt_text: prompt,
        model: result.model,
        model_params: { temperature, max_tokens: maxTokens },
        model_response: result.response,
        score: 0,
        score_breakdown: {},
        tokens_used: result.tokens_used,
        cost_estimate: result.cost_estimate,
        duration_ms: result.duration_ms,
      }));

      const { error: insertError } = await supabase.from('prompt_attempts').insert(payload);
      if (insertError) {
        throw new Error(insertError.message);
      }

      await fetchUsageStats();
      setHasAcknowledgedCostRisk(false);

      toast({
        title: 'Success!',
        description: `Compared ${modelResults.length} models`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to run prompt',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalCost = results.reduce((sum, r) => sum + r.cost_estimate, 0);
  const avgDuration = results.length > 0
    ? results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length
    : 0;

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            AI Playground
          </h1>
          <p className="text-muted-foreground">
            Compare prompts across multiple AI models in real-time
          </p>
        </div>

        {(nearAttemptLimit || nearCostLimit) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Quota almost used</AlertTitle>
            <AlertDescription>
              {nearAttemptLimit &&
                `You've used ${usageStats.attemptsToday}/${DAILY_MODEL_CALL_LIMIT} model calls today. `}
              {nearCostLimit &&
                `Estimated spend is $${usageStats.costToday.toFixed(
                  2
                )} out of $${DAILY_COST_LIMIT.toFixed(2)}.`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Models</CardTitle>
                <CardDescription>Choose models to compare</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {AVAILABLE_MODELS.map((modelKey) => {
                  const model = AI_MODELS[modelKey];
                  const isSelected = selectedModels.includes(modelKey);
                  const isBudgetLocked =
                    budgetMode && !BUDGET_MODELS.includes(modelKey as (typeof BUDGET_MODELS)[number]);
                  const estimatedModelCost = costByModel.get(modelKey);

                  return (
                    <div
                      key={modelKey}
                      onClick={() => {
                        if (isBudgetLocked) return;
                        toggleModel(modelKey);
                      }}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      } ${isBudgetLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {model.provider}
                          </div>
                          {estimatedModelCost !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Est. ${estimatedModelCost.toFixed(2)} / run
                            </div>
                          )}
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                          }`}
                        >
                          {isSelected && <div className="h-2 w-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Budget mode</p>
                    <p className="text-xs text-muted-foreground">
                      Keeps selection to low-cost models.
                    </p>
                  </div>
                  <Switch checked={budgetMode} onCheckedChange={handleBudgetToggle} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="text-sm text-muted-foreground">{temperature}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    onValueChange={([v]) => setTemperature(v)}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher values make output more random
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Max Tokens</Label>
                    <span className="text-sm text-muted-foreground">{maxTokens}</span>
                  </div>
                  <Slider
                    value={[maxTokens]}
                    onValueChange={([v]) => setMaxTokens(v)}
                    min={100}
                    max={4000}
                    step={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum response length
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage today</CardTitle>
                <CardDescription>Daily quota resets at midnight.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Model calls</span>
                    <span>
                      {usageStats.attemptsToday}/{DAILY_MODEL_CALL_LIMIT}
                    </span>
                  </div>
                  <Progress value={attemptUsagePercent} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Estimated spend</span>
                    <span>
                      ${usageStats.costToday.toFixed(2)}/{DAILY_COST_LIMIT.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={costUsagePercent} />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={fetchUsageStats}
                  disabled={usageLoading}
                >
                  {usageLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Refresh usage
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Your Prompt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  className="min-h-[150px] font-mono text-sm"
                />

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} selected
                  </div>
                  <Button
                    onClick={handleRunPrompt}
                    disabled={disableRunButton}
                    size="lg"
                    className="gap-2"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Run Comparison
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estimated cost & safety</CardTitle>
                <CardDescription>
                  Based on ~{costEstimate.assumedInputTokens} input tokens + {maxTokens} output tokens.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated cost this run</p>
                    <p className="text-3xl font-bold">
                      ${estimatedCost.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={showHighCostWarning ? 'destructive' : 'secondary'}>
                    {selectedModelCount} model{selectedModelCount !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  {costEstimate.breakdown.length === 0 && (
                    <p className="text-muted-foreground">Select a model to see cost estimates.</p>
                  )}
                  {costEstimate.breakdown.map(({ modelKey, model, cost }) => (
                    <div key={modelKey} className="flex items-center justify-between">
                      <span>{model.name}</span>
                      <span className="font-medium">${cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {(showHighCostWarning || showRateLimitWarning) && (
                  <div className="space-y-2">
                    {showHighCostWarning && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>High cost run</AlertTitle>
                        <AlertDescription>
                          Consider enabling budget mode, lowering max tokens, or reducing models.
                        </AlertDescription>
                      </Alert>
                    )}
                    {showRateLimitWarning && (
                      <Alert>
                        <AlertTitle>Large batch</AlertTitle>
                        <AlertDescription>
                          Requests are queued to avoid rate limits. Runs with {selectedModelCount} models may take longer.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {needsCostAcknowledgement && (
                  <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <Checkbox
                      id="cost-ack"
                      checked={hasAcknowledgedCostRisk}
                      onCheckedChange={(value) => setHasAcknowledgedCostRisk(Boolean(value))}
                    />
                    <label htmlFor="cost-ack" className="cursor-pointer">
                      I understand this comparison may cost up to ${estimatedCost.toFixed(2)} today.
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            {results.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Total Cost</span>
                      </div>
                      <div className="text-2xl font-bold">
                        ${totalCost.toFixed(4)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Avg Duration</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {(avgDuration / 1000).toFixed(2)}s
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Total Tokens</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {results.reduce((sum, r) => sum + r.tokens_used, 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="0" className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {results.map((result, index) => {
                      const modelKey = Object.keys(AI_MODELS).find(
                        (key) => AI_MODELS[key].id === result.model
                      );
                      const model = modelKey ? AI_MODELS[modelKey] : null;
                      return (
                        <TabsTrigger key={index} value={index.toString()}>
                          {model?.name || result.model}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {results.map((result, index) => {
                    const modelKey = Object.keys(AI_MODELS).find(
                      (key) => AI_MODELS[key].id === result.model
                    );
                    const model = modelKey ? AI_MODELS[modelKey] : null;

                    return (
                      <TabsContent key={index} value={index.toString()} className="mt-4">
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{model?.name}</CardTitle>
                                <CardDescription className="capitalize">
                                  {result.provider}
                                </CardDescription>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(result.response, index)}
                              >
                                {copiedIndex === index ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="prose prose-sm max-w-none">
                              <p className="whitespace-pre-wrap">{result.response}</p>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-4 border-t">
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                {(result.duration_ms / 1000).toFixed(2)}s
                              </Badge>
                              <Badge variant="secondary">
                                <DollarSign className="h-3 w-3 mr-1" />
                                ${result.cost_estimate.toFixed(4)}
                              </Badge>
                              <Badge variant="secondary">
                                <BarChart3 className="h-3 w-3 mr-1" />
                                {result.tokens_used} tokens
                              </Badge>
                              <Badge variant="outline">
                                In: {result.input_tokens} | Out: {result.output_tokens}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
