# Promptcademy.co - Phase 2 Release

A production-ready platform for learning prompt engineering through interactive lessons, real-time AI feedback, multi-model comparison, and gamified challenges.

## What's Been Built

### Phase 2 (NEW!) - Advanced Features

1. **Multi-Model AI Playground**

   - Compare prompts across 7 AI models simultaneously:
     - OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo
     - Anthropic: Claude 3.5 Sonnet, Claude 3.5 Haiku
     - Google: Gemini 1.5 Pro, Gemini 1.5 Flash
   - Side-by-side response comparison
   - Real-time cost and token tracking per model
   - Performance metrics (response time, tokens, cost)
   - Advanced parameter controls (temperature, max_tokens)

2. **Admin Content Management System**

   - Full admin dashboard with platform statistics
   - Create, edit, and delete courses
   - Publish/unpublish courses
   - Role-based access control (admin, teacher, user)
   - Secure RLS policies for content management
   - Course management interface with lesson counts

3. **Prompt Template Library**
   - Save frequently-used prompts as reusable templates
   - Organize templates with tags and descriptions
   - Share templates publicly with the community
   - Browse community-contributed templates
   - Copy templates to clipboard
   - Private and public template visibility
   - Model recommendation per template

### Phase 1 - Core Features

1. **Authentication & User Management**

   - Email/password signup and login via Supabase Auth
   - Secure session management
   - User profiles with preferences

2. **Personalized Onboarding**

   - Goal selection (Writing, Coding, Design, Research, General)
   - Skill level assessment (Beginner, Intermediate, Advanced)
   - Personalized learning path creation

3. **Course & Lesson System**

   - Browse courses filtered by goal
   - View course details with progress tracking
   - Interactive lesson viewer with:
     - Lesson content and learning objectives
     - Example prompts
     - Progressive hints
     - Expected success criteria

4. **AI Playground (OpenAI Integration)**

   - Write and test prompts in real-time
   - Get immediate AI responses
   - Integrated with lesson flow

5. **Intelligent Scoring Engine**

   - Automatic prompt quality assessment
   - Multi-dimensional scoring:
     - Clarity (0-20 points)
     - Constraints (0-15 points)
     - Specificity (0-20 points)
     - Token Efficiency (0-15 points)
     - Criteria Match (0-30 points)
   - Actionable feedback and improvement suggestions
   - Progress tracking and best score recording

6. **Progress Dashboard**

   - View completed lessons
   - Track total attempts and average score
   - Course progress visualization
   - Quick access to continue learning

7. **Seed Content**
   - 3 courses across different goals
   - 4 complete lessons with:
     - Structured learning content
     - Multiple example prompts
     - Progressive hints
     - Success criteria

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI Provider**: OpenAI API (GPT-4o)
- **Styling**: Cosmic Night theme (purple/blue palette)

## Database Schema

Tables created with full RLS (Row Level Security):

- `profiles` - User profiles and preferences
- `courses` - Learning courses
- `lessons` - Individual lessons within courses
- `prompt_templates` - Reusable prompt templates
- `prompt_attempts` - User prompt submissions with scoring
- `user_progress` - Lesson completion tracking
- `challenges` - Future: timed challenges
- `badges` - Achievement system
- `user_badges` - User badge awards

## Setup Instructions

### Prerequisites

1. Node.js 18+ installed
2. Supabase account (already configured)
3. OpenAI API key

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure Environment Variables:**

   Add your AI provider API keys to `.env`:

   ```
   # Required for basic playground
   NEXT_PUBLIC_OPENAI_API_KEY=sk-your-openai-api-key

   # Required for AI Analyzer API routes (server-side)
   OPENAI_API_KEY=sk-your-openai-api-key

   # Optional - for multi-model comparison
   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
   NEXT_PUBLIC_GOOGLE_API_KEY=your-google-api-key
   ```

   Supabase credentials are already configured.

   **Note**: Only OpenAI key is required for basic functionality. Add other provider keys to enable multi-model comparison.

### Fonts & Network Access

Promptcademy uses the Inter font through `next/font/google`. During `next dev`/`next build`, Next.js downloads Inter from Google Fonts. If your environment restricts outbound traffic, allow the following hosts:

- `fonts.googleapis.com`
- `fonts.gstatic.com`

If those endpoints must remain blocked, replace the Inter import in `app/layout.tsx` with `next/font/local` and bundle the `.woff2` files in the repo.

### Provider API Keys & Fallback Behavior

- Add your personal keys under **Settings → API Keys** inside the app. Each key is encrypted and scoped to your account so playground/lesson runs are billed to you.
- If you do not add a key for a provider, Promptcademy falls back to the shared workspace key configured via environment variables. Fallback keys are shared by everyone and often hit rate limits quickly.
- The playground and lesson pages display a warning when you are relying on the fallback. Add your own keys to avoid interruptions and to keep per-provider cost tracking accurate.

### Testing & QA

- **Manual**: run through `docs/QA_CHECKLIST.md` for every release (Chrome + Safari passes, Gemini key checks, history/analytics validation, etc.).
- **Automated smoke test** (Playwright):

  1. Install browsers: `npx playwright install --with-deps`
  2. Start the app at `E2E_BASE_URL` (defaults to `http://localhost:3000`).
  3. Export `E2E_EMAIL`, `E2E_PASSWORD`, and `E2E_LESSON_URL` (absolute URL or path). Optionally override `E2E_BASE_URL`.
  4. Run `npm run test:e2e`.

  The smoke test logs in with the supplied credentials, opens the lesson, and runs a prompt end-to-end. It automatically skips if the required env vars are missing so CI remains green.

3. **Run Development Server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build for Production:**
   ```bash
   npm run build
   npm run start
   ```

## Usage Flow

### For New Users:

1. Visit landing page
2. Click "Get Started" → Sign up with email/password
3. Complete onboarding:
   - Select learning goals
   - Choose skill level
4. Redirected to personalized dashboard
5. Browse courses matching your goals
6. Start a course → Begin lessons
7. For each lesson:
   - Read lesson content
   - Review examples and hints
   - Write your prompt in the playground
   - Run the prompt to get AI response
   - Receive instant scoring and feedback
   - Iterate to improve
   - Complete lesson (score ≥75)
8. Track progress on dashboard

### For Advanced Users:

**Using the Multi-Model Playground:**

1. Navigate to Playground from the main menu
2. Select 2-7 AI models to compare
3. Adjust temperature and max tokens parameters
4. Enter your prompt
5. Click "Run Comparison"
6. View side-by-side responses with metrics
7. Compare cost, speed, and quality across models

**Managing Prompt Templates:**

1. Navigate to Templates from the main menu
2. Click "New Template" to save a reusable prompt
3. Add title, description, and tags
4. Choose to make it public or keep it private
5. Browse community templates for inspiration
6. Copy any template to use in lessons or playground

**For Admins/Teachers:**

1. Access the Admin panel from navigation (visible if you have admin/teacher role)
2. View platform statistics (users, courses, lessons, attempts)
3. Create new courses with customizable settings
4. Publish/unpublish courses
5. Manage existing courses and their lessons
6. Track platform engagement metrics

To become an admin, update your profile role in the database:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### Scoring System

Prompts are evaluated on:

- **Clarity** (20 pts): Length, specificity, clear instructions
- **Constraints** (15 pts): Format requirements, length specs
- **Specificity** (20 pts): Action words, tone indicators
- **Token Efficiency** (15 pts): Conciseness vs. completeness
- **Criteria Match** (30 pts): Meeting lesson-specific requirements

**Total: 100 points**

- 90-100: Outstanding
- 75-89: Great (Lesson complete!)
- 60-74: Good (needs improvement)
- <60: Keep practicing

## Project Structure

```
/app
  /(auth)
    /login          # Sign in page
    /signup         # Registration page
  /onboarding       # Goal & skill selection
  /dashboard        # User progress overview
  /courses          # Course listing
    /[courseId]     # Course detail & lessons
      /lessons/[lessonId]  # Interactive lesson viewer
  /challenges       # Future: challenge system
/components
  /ui               # shadcn/ui components
  /app-layout.tsx   # Authenticated page layout
/lib
  /auth-context.tsx    # Authentication provider
  /supabase.ts         # Supabase client & types
  /openai-service.ts   # OpenAI API integration
  /scoring-service.ts  # Prompt scoring logic
```

## Security Features

✅ Row Level Security (RLS) on all tables
✅ Users can only access their own data
✅ Public read access for courses/lessons/badges
✅ Password hashing via Supabase Auth
✅ Secure session management
✅ API keys in environment variables (not committed)

## Phase 2 Completed Features ✅

These features were successfully added in Phase 2:

- ✅ Multi-model comparison (OpenAI, Claude, Gemini)
- ✅ Admin content authoring UI
- ✅ Prompt template library with sharing
- ✅ Role-based access control
- ✅ 7 AI models integrated and working

## Future Enhancements (Phase 3+)

The following are planned for future releases:

- Stripe billing and subscriptions with usage tiers
- Team/organization multi-tenancy
- Challenge submission and peer review system
- Leaderboards and competitive features
- Image generation prompts (Midjourney, DALL-E)
- Advanced analytics dashboard with visualizations
- Production infrastructure (Terraform, CI/CD, monitoring)
- Comprehensive testing suite (E2E, integration)
- Email notifications for progress and achievements
- Mobile app (React Native)
- API rate limiting and usage quotas per user
- AI-powered scoring (ML-based evaluation)

## Current Limitations

1. **AI API Keys Required**: You must provide your own API keys for AI providers
2. **No Email Verification**: Signups are immediate without email confirmation
3. **Limited Seed Content**: Only 4 lessons included (admins can add more via UI)
4. **No Usage Quotas**: API usage not limited per user
5. **Basic Scoring**: Heuristic-based, not ML-powered (still effective)
6. **No Billing**: All features are free (add Stripe for monetization)
7. **Team Settings Coming Soon**: Team workspaces exist, but membership/plan controls are still under construction (UI shows “Coming Soon” notice)

## Observability & Operations

See `docs/OBSERVABILITY.md` for logging, monitoring, and backup procedures. It covers the new structured logs emitted by `/api/ai/run`, recommended Supabase alerts (RLS errors, usage spikes), and the backup/restore drill that includes all new tables (`user_api_keys`, `team_members`, etc.).

## Deployment

### Vercel (Recommended)

1. Connect your Git repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Self-Hosted

1. Build the project: `npm run build`
2. Start: `npm run start`
3. Configure reverse proxy (nginx, etc.)
4. Set up SSL certificate

## Database Migrations

All migrations are already applied. The database schema includes:

- User authentication tables (managed by Supabase)
- 9 custom application tables
- Row Level Security policies
- Indexes for performance
- Foreign key relationships
- Automatic timestamp updates

To view migrations, check the Supabase dashboard under "Database" → "Migrations".

## Cost Estimates (Per User)

**Free Tier Usage:**

- Supabase: Free up to 500MB database + 50,000 monthly active users
- Vercel: Free for personal projects

**API Costs (You Pay):**

- OpenAI GPT-4o: ~$0.0025 per prompt attempt (input) + $0.01 per response (output)
- Average lesson: 10-20 attempts = $0.05-$0.10
- Complete course (10 lessons): $0.50-$1.00

**Scaling Considerations:**

- 1,000 active users: ~$500-1,000/month (OpenAI only)
- Caching and prompt reuse can reduce costs by 30-50%

## Support & Documentation

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **OpenAI API Docs**: https://platform.openai.com/docs
- **shadcn/ui**: https://ui.shadcn.com

## Contributing

This is a Phase 1 MVP. To extend:

1. Add more lessons by inserting into the `lessons` table
2. Integrate new AI providers in `lib/openai-service.ts`
3. Enhance scoring algorithm in `lib/scoring-service.ts`
4. Build out challenges system (schema already exists)
5. Implement billing via Stripe
6. Add admin UI for content management

## License

Proprietary - All rights reserved

---

**Built with ❤️ using Next.js, Supabase, and OpenAI**
