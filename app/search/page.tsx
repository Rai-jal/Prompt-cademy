"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarLayout } from "@/components/sidebar-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import {
  Search,
  Filter,
  BookOpen,
  FileText,
  Trophy,
  Users,
  Calendar,
  Tag,
} from "lucide-react";
import Link from "next/link";

type SearchResult = {
  id: string;
  type: "course" | "template" | "challenge" | "user";
  title: string;
  description: string;
  tags?: string[];
  created_at: string;
  metadata?: any;
};

function SearchPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    sortBy: "relevance",
    dateRange: "all",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const searchResults: SearchResult[] = [];

      if (filters.type === "all" || filters.type === "courses") {
        const { data: courses } = await supabase
          .from("courses")
          .select("*")
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .eq("is_published", true)
          .limit(10);

        if (courses) {
          searchResults.push(
            ...courses.map((course) => ({
              id: course.id,
              type: "course" as const,
              title: course.title,
              description: course.description,
              created_at: course.created_at,
              metadata: {
                goal: course.goal,
                difficulty: course.difficulty,
              },
            }))
          );
        }
      }

      if (filters.type === "all" || filters.type === "templates") {
        const { data: templates } = await supabase
          .from("prompt_templates")
          .select("*")
          .or(
            `title.ilike.%${query}%,content.ilike.%${query}%,description.ilike.%${query}%`
          )
          .eq("is_public", true)
          .limit(10);

        if (templates) {
          searchResults.push(
            ...templates.map((template) => ({
              id: template.id,
              type: "template" as const,
              title: template.title,
              description:
                template.description || template.content.slice(0, 150),
              tags: template.tags,
              created_at: template.created_at,
              metadata: {
                model: template.model_recommendation,
              },
            }))
          );
        }
      }

      if (filters.type === "all" || filters.type === "challenges") {
        const { data: challenges } = await supabase
          .from("challenges")
          .select("*")
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(10);

        if (challenges) {
          searchResults.push(
            ...challenges.map((challenge) => ({
              id: challenge.id,
              type: "challenge" as const,
              title: challenge.title,
              description: challenge.description,
              created_at: challenge.created_at,
              metadata: {
                difficulty: challenge.difficulty,
                points: challenge.points,
              },
            }))
          );
        }
      }

      if (filters.type === "all" || filters.type === "users") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);

        if (profiles) {
          searchResults.push(
            ...profiles.map((profile) => ({
              id: profile.id,
              type: "user" as const,
              title: profile.full_name || profile.email,
              description: profile.bio || "No bio available",
              created_at: profile.created_at,
              metadata: {
                skill_level: profile.skill_level,
                role: profile.role,
              },
            }))
          );
        }
      }

      if (filters.sortBy === "date") {
        searchResults.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      setResults(searchResults);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setSearching(false);
    }
  }, [filters, query]);

  useEffect(() => {
    if (query) {
      handleSearch();
    }
  }, [query, handleSearch]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "course":
        return <BookOpen className="h-4 w-4" />;
      case "template":
        return <FileText className="h-4 w-4" />;
      case "challenge":
        return <Trophy className="h-4 w-4" />;
      case "user":
        return <Users className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeLink = (result: SearchResult) => {
    switch (result.type) {
      case "course":
        return `/courses/${result.id}`;
      case "template":
        return `/templates`;
      case "challenge":
        return `/challenges/${result.id}`;
      case "user":
        return `/profile`;
      default:
        return "#";
    }
  };

  if (loading) {
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
            <Search className="h-8 w-8 text-primary" />
            Search
          </h1>
          <p className="text-muted-foreground">
            Find courses, templates, challenges, and users
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for anything..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters({ ...filters, type: value })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="courses">Courses</SelectItem>
                  <SelectItem value="templates">Templates</SelectItem>
                  <SelectItem value="challenges">Challenges</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.sortBy}
                onValueChange={(value) =>
                  setFilters({ ...filters, sortBy: value })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Most Recent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
            </div>

            {results.map((result) => (
              <Card
                key={`${result.type}-${result.id}`}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {getTypeIcon(result.type)}
                          {result.type}
                        </Badge>
                        {result.metadata?.difficulty && (
                          <Badge variant="outline">
                            {result.metadata.difficulty}
                          </Badge>
                        )}
                        {result.metadata?.goal && (
                          <Badge variant="outline">
                            {result.metadata.goal}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl mb-1">
                        <Link
                          href={getTypeLink(result)}
                          className="hover:text-primary transition-colors"
                        >
                          {result.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {result.description}
                      </CardDescription>
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {result.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link href={getTypeLink(result)}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {query && !searching && results.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or filters
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
