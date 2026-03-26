"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { useMyProfile, useUpdateMyProfile } from "@/lib/api-hooks";
import { useToast } from "@/ui/toast";
import { useSession } from "@/lib/session";

export default function ProfileSettingsPage() {
  const profile = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const toast = useToast();
  const { setToken } = useSession();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.full_name ?? "");
    setEmail(profile.data.email ?? "");
  }, [profile.data]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="text-sm text-white/60">Manage your display name and contact details.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            label="Full name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={profile.isLoading || updateProfile.isPending}
              onClick={() =>
                updateProfile.mutate(
                  { email, full_name: fullName.trim() || undefined },
                  {
                    onSuccess: (result) => {
                      if (result.access_token) {
                        setToken(result.access_token);
                      }
                      toast.push({ title: "Profile updated", variant: "success" });
                    },
                    onError: (error) => {
                      toast.push({
                        title: "Profile update failed",
                        description: String(error instanceof Error ? error.message : error),
                        variant: "error",
                      });
                    },
                  }
                )
              }
            >
              {updateProfile.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
