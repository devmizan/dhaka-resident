"use client";

import type { ReactNode } from "react";
import { KeyRound, MessageSquareText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Switches between password and one-time-code forms on the login and sign-up pages. */
export function AuthMethodTabs({ defaultMethod, password, code, codeLabel = "One-time code" }: { defaultMethod: "password" | "code"; password: ReactNode; code: ReactNode; codeLabel?: string }) {
  return (
    <Tabs defaultValue={defaultMethod} className="gap-5">
      <TabsList className="grid h-11! w-full grid-cols-2">
        <TabsTrigger value="password" className="h-9">
          <KeyRound data-icon="inline-start" />
          Password
        </TabsTrigger>
        <TabsTrigger value="code" className="h-9">
          <MessageSquareText data-icon="inline-start" />
          {codeLabel}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="code">{code}</TabsContent>
      <TabsContent value="password">{password}</TabsContent>
    </Tabs>
  );
}
