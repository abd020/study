import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/common/loading";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";

import NotFoundPage from "@/pages/not-found";

// Les pages applicatives sont chargées à la demande : le bundle initial ne
// contient que l'authentification et la coquille.
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const CoursesPage = lazy(() => import("@/pages/courses"));
const CourseDetailPage = lazy(() => import("@/pages/course-detail"));
const StudyPage = lazy(() => import("@/pages/study"));
const FlashcardsSessionPage = lazy(() => import("@/pages/study-flashcards"));
const QuizzesPage = lazy(() => import("@/pages/quizzes"));
const QuizPlayerPage = lazy(() => import("@/pages/quiz-player"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const ProgressPage = lazy(() => import("@/pages/progress"));
const SettingsPage = lazy(() => import("@/pages/settings"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Vérification de la session…" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>} />
      <Route path="/signup" element={<RedirectIfAuthenticated><SignupPage /></RedirectIfAuthenticated>} />
      <Route path="/forgot-password" element={<RedirectIfAuthenticated><ForgotPasswordPage /></RedirectIfAuthenticated>} />
      {/* Accessible connecté (lien email) comme déconnecté. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <Suspense fallback={<LoadingScreen />}>
              <AppShell />
            </Suspense>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:courseId" element={<CourseDetailPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="study/flashcards" element={<FlashcardsSessionPage />} />
        <Route path="quizzes" element={<QuizzesPage />} />
        <Route path="quizzes/:quizId" element={<QuizPlayerPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Router>
              <AppRoutes />
            </Router>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
