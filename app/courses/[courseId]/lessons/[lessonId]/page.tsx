"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { SidebarLayout } from "@/components/sidebar-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, Lesson, UserProgress } from "@/lib/supabase";
import { runPromptViaApi } from "@/lib/client/ai";
import { AI_MODELS } from "@/lib/ai-models";
import { scorePrompt, ScoreBreakdown } from "@/lib/scoring-service";
import { useUserApiKeys } from "@/hooks/use-user-api-keys";
import {
  Lightbulb,
  Sparkles,
  Send,
  CheckCircle2,
  TrendingUp,
  Clock,
  Target,
  Zap,
  ChevronLeft,
} from "lucide-react";

const LESSON_MODELS = [
  "gemini-pro",
  "gemini-flash",
  "gpt-4o",
  "gpt-4o-mini",
] as const;
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function LessonPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-pro");
  const { keys: apiKeys } = useUserApiKeys();
  const activeProviders = useMemo(
    () =>
      new Set(
        apiKeys.filter((key) => key.is_active).map((key) => key.provider)
      ),
    [apiKeys]
  );
  const isModelEnabled = useCallback(
    (modelKey: string) => {
      const provider = AI_MODELS[modelKey]?.provider;
      if (!provider) return false;
      return activeProviders.has(provider);
    },
    [activeProviders]
  );
  const hasGoogleKey = activeProviders.has("google");
  const hasAvailableModel = useMemo(
    () => LESSON_MODELS.some((modelKey) => isModelEnabled(modelKey)),
    [isModelEnabled]
  );

  useEffect(() => {
    const currentProvider = AI_MODELS[selectedModel]?.provider;
    if (currentProvider && activeProviders.has(currentProvider)) {
      return;
    }

    const fallbackModel = LESSON_MODELS.find((modelKey) => {
      const provider = AI_MODELS[modelKey]?.provider;
      return provider && activeProviders.has(provider);
    });

    if (fallbackModel) {
      setSelectedModel(fallbackModel);
    }
  }, [activeProviders, selectedModel]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const loadLessonData = useCallback(async () => {
    try {
      const { data: lessonData } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", lessonId)
        .maybeSingle();

      if (!lessonData) {
        router.push(`/courses/${courseId}`);
        return;
      }

      setLesson(lessonData);

      const { data: progressData } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user!.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      setProgress(progressData);

      if (!progressData) {
        await supabase.from("user_progress").insert({
          user_id: user!.id,
          lesson_id: lessonId,
          status: "in_progress",
        });
      } else if (progressData.status === "not_started") {
        await supabase
          .from("user_progress")
          .update({ status: "in_progress" })
          .eq("id", progressData.id);
      }
    } catch (error) {
      console.error("Error loading lesson:", error);
    } finally {
      setLoadingData(false);
    }
  }, [courseId, lessonId, router, user]);

  useEffect(() => {
    if (user && lessonId) {
      loadLessonData();
    }
  }, [user, lessonId, loadLessonData]);

  const handleRunPrompt = async () => {
    if (!prompt.trim() || !lesson) {
      toast({
        title: "Empty prompt",
        description: "Please enter a prompt to test.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setResponse("");
    setScore(null);

    try {
      const result = await runPromptViaApi(prompt, selectedModel);

      if (result.error) {
        throw new Error(result.error);
      }
      setResponse(result.response);

      const promptScore = scorePrompt(prompt, lesson, result.tokens_used);
      setScore(promptScore);

      await supabase.from("prompt_attempts").insert({
        user_id: user!.id,
        lesson_id: lessonId,
        prompt_text: prompt,
        model: selectedModel,
        model_params: {},
        model_response: result.response,
        score: promptScore.total,
        score_breakdown: promptScore,
        tokens_used: result.tokens_used,
        cost_estimate: result.cost_estimate,
        duration_ms: result.duration_ms,
      });

      if (progress) {
        const newBestScore = Math.max(progress.best_score, promptScore.total);
        const newAttemptsCount = progress.attempts_count + 1;
        const isCompleted = promptScore.total >= 75;

        await supabase
          .from("user_progress")
          .update({
            best_score: newBestScore,
            attempts_count: newAttemptsCount,
            status: isCompleted ? "completed" : "in_progress",
            completed_at:
              isCompleted && !progress.completed_at
                ? new Date().toISOString()
                : progress.completed_at,
          })
          .eq("id", progress.id);

        if (isCompleted && !progress.completed_at) {
          toast({
            title: "Lesson Complete!",
            description:
              "Congratulations! You can now move to the next lesson.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to run prompt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lesson) {
    return null;
  }

  const content = lesson.content;
  const selectedModelInfo = AI_MODELS[selectedModel];

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto">
        <Link href={`/courses/${courseId}`}>
          <Button variant="ghost" className="mb-4 gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Course
          </Button>
        </Link>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{lesson.title}</CardTitle>
                <CardDescription className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lesson.estimated_duration} min
                  </span>
                  {progress && progress.best_score > 0 && (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Best: {progress.best_score}/100
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-base leading-relaxed">
                    {content.introduction}
                  </p>
                </div>

                {content.sections && content.sections.length > 0 && (
                  <div className="space-y-3">
                    {content.sections.map((section: any, index: number) => (
                      <div
                        key={index}
                        className="border-l-2 border-primary/30 pl-4"
                      >
                        <h4 className="font-semibold mb-1">
                          {section.heading}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Your Task:</strong> {content.task}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {lesson.example_prompts && lesson.example_prompts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Example Prompts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lesson.example_prompts.map((example, index) => (
                    <div
                      key={index}
                      className="p-3 bg-muted rounded-md text-sm font-mono cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => setPrompt(example)}
                    >
                      {example}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    Click an example to use it as a starting point
                  </p>
                </CardContent>
              </Card>
            )}

            {lesson.hints && lesson.hints.length > 0 && (
              <Card>
                <CardHeader>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-0 h-auto"
                    onClick={() => setShowHints(!showHints)}
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      <span className="text-lg font-semibold">Hints</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {showHints ? "Hide" : "Show"}
                    </span>
                  </Button>
                </CardHeader>
                {showHints && (
                  <CardContent className="space-y-2">
                    {lesson.hints.map((hint, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-primary font-bold">
                          {index + 1}.
                        </span>
                        <p className="text-sm text-muted-foreground">{hint}</p>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  AI Playground
                </CardTitle>
                <CardDescription>Write and test your prompt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your prompt here..."
                    className="min-h-[120px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lesson-model">Model</Label>
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    disabled={!hasAvailableModel}
                  >
                    <SelectTrigger id="lesson-model">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {LESSON_MODELS.map((modelKey) => {
                        const model = AI_MODELS[modelKey];
                        if (!model) return null;
                        const disabled = !isModelEnabled(modelKey);
                        return (
                          <SelectItem
                            key={modelKey}
                            value={modelKey}
                            disabled={disabled}
                          >
                            {model.name} ({model.provider})
                            {!disabled ? null : " – add API key"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedModelInfo && (
                    <p className="text-xs text-muted-foreground">
                      Runs on {selectedModelInfo.name} (
                      {selectedModelInfo.provider}). Make sure you have an
                      active
                      {selectedModelInfo.provider === "google"
                        ? " Google/Gemini"
                        : selectedModelInfo.provider === "anthropic"
                        ? " Anthropic"
                        : " OpenAI"}{" "}
                      key in Settings.
                    </p>
                  )}
                  {!hasAvailableModel && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Add an API key in Settings → API Keys to enable lesson
                        playground runs. Gemini models require an active Google
                        key.
                      </AlertDescription>
                    </Alert>
                  )}
                  {!hasGoogleKey && (
                    <p className="text-xs text-muted-foreground">
                      Add a Google/Gemini key in Settings → API Keys to unlock
                      Gemini models.
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleRunPrompt}
                  disabled={isRunning || !prompt.trim() || !hasAvailableModel}
                  className="w-full gap-2"
                >
                  {isRunning ? (
                    <>Running...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Run Prompt
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {(response || score) && (
              <Tabs defaultValue="response" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="score">Score & Feedback</TabsTrigger>
                </TabsList>

                <TabsContent value="response" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">AI Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-sm">
                          {response}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="score" className="mt-4">
                  {score && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Your Score</CardTitle>
                          <div className="text-3xl font-bold text-primary">
                            {score.total}
                            <span className="text-lg text-muted-foreground">
                              /100
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Clarity</span>
                            <span className="font-medium">
                              {score.clarity}/20
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Constraints</span>
                            <span className="font-medium">
                              {score.constraints}/15
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Specificity</span>
                            <span className="font-medium">
                              {score.specificity}/20
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Token Efficiency</span>
                            <span className="font-medium">
                              {score.token_efficiency}/15
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Criteria Match</span>
                            <span className="font-medium">
                              {score.criteria_match}/30
                            </span>
                          </div>
                        </div>

                        <Alert>
                          <TrendingUp className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-2">
                              {score.feedback.map((fb, index) => (
                                <p key={index} className="text-sm">
                                  {fb}
                                </p>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>

                        {score.total >= 75 && (
                          <Alert className="border-primary/50 bg-primary/5">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-primary font-medium">
                              Excellent work! You&rsquo;ve passed this lesson.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
