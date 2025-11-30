'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Sparkles, Pencil, Code, Palette, Search, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const goals = [
  { id: 'writing', label: 'Writing', icon: Pencil, description: 'Content creation, marketing, storytelling' },
  { id: 'coding', label: 'Coding', icon: Code, description: 'Software development, debugging, documentation' },
  { id: 'design', label: 'Design', icon: Palette, description: 'Visual creation, UI/UX, creative assets' },
  { id: 'research', label: 'Research', icon: Search, description: 'Data analysis, information gathering' },
  { id: 'general', label: 'General', icon: Zap, description: 'All-purpose AI usage' },
];

const skillLevels = [
  { id: 'beginner', label: 'Beginner', description: 'New to AI and prompting' },
  { id: 'intermediate', label: 'Intermediate', description: 'Some experience with AI tools' },
  { id: 'advanced', label: 'Advanced', description: 'Comfortable with prompt engineering' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState<string>('beginner');
  const [loading, setLoading] = useState(false);
  const { updateProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
    );
  };

  const handleComplete = async () => {
    if (selectedGoals.length === 0) {
      toast({
        title: 'Select at least one goal',
        description: 'Please choose at least one learning path to continue.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await updateProfile({
      goals: selectedGoals,
      skill_level: skillLevel as 'beginner' | 'intermediate' | 'advanced',
      onboarding_completed: true,
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
    } else {
      toast({
        title: 'Welcome to Promptcademy!',
        description: 'Your learning path has been personalized.',
      });
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Promptcademy
          </div>
          <p className="text-muted-foreground">Let&rsquo;s personalize your learning journey</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2">
                {[1, 2].map((s) => (
                  <div
                    key={s}
                    className={`h-2 w-16 rounded-full transition-colors ${
                      s <= step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Step {step} of 2
              </span>
            </div>
            <CardTitle>
              {step === 1 ? 'Choose Your Goals' : 'Select Your Skill Level'}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? 'Pick one or more areas you want to focus on'
                : 'Help us tailor lessons to your experience'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const Icon = goal.icon;
                  const isSelected = selectedGoals.includes(goal.id);
                  return (
                    <div
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{goal.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {goal.description}
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {isSelected && (
                            <div className="h-2 w-2 bg-white rounded-full" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <RadioGroup value={skillLevel} onValueChange={setSkillLevel}>
                <div className="space-y-3">
                  {skillLevels.map((level) => (
                    <div
                      key={level.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        skillLevel === level.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSkillLevel(level.id)}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={level.id} id={level.id} />
                        <Label htmlFor={level.id} className="flex-1 cursor-pointer">
                          <div className="font-semibold">{level.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {level.description}
                          </div>
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={selectedGoals.length === 0}
                  className="flex-1"
                >
                  Continue
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={loading} className="flex-1">
                  {loading ? 'Completing...' : 'Complete Setup'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
