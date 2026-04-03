import { redirect } from "next/navigation";
import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { requireAuth } from "@/lib/auth/requireAuth";
import { ProjectsProvider } from "@/providers/ProjectsContext";
import { VoiceModeProvider } from "@/providers/VoiceModeProvider";
import AppSidebar from "@/sections/sidebar/AppSidebar";

export interface LayoutProps {
  children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
  noStore();

  // Only check authentication - data fetching is done client-side via SWR hooks
  const authResult = await requireAuth();

  if (authResult.redirect) {
    redirect(authResult.redirect as Route);
  }

  return (
    <ProjectsProvider>
      {/* VoiceModeProvider wraps the full app layout so TTS playback state
          persists across page navigations (e.g., sidebar clicks during playback).
          It only activates WebSocket connections when TTS is actually triggered. */}
      <VoiceModeProvider>
        <div className="flex h-[100dvh] min-h-[100dvh] w-full min-w-0 overflow-hidden">
          <AppSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </VoiceModeProvider>
    </ProjectsProvider>
  );
}
