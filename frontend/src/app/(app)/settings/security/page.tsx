import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Security</h2>
        <p className="text-sm text-white/60">Session, MFA, and device controls.</p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Session</CardTitle>
          <Badge tone="outline">Local token storage</Badge>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/80">Current device session</div>
            <div className="text-xs text-white/60">Switch to HttpOnly cookies when backend is ready.</div>
          </div>
          <Button variant="outline" size="sm">Sign out other sessions</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Multi-factor auth</CardTitle>
          <Badge tone="warn">Recommended</Badge>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/80">TOTP app</div>
            <div className="text-xs text-white/60">Add an authenticator app for stronger security.</div>
          </div>
          <Button size="sm">Enable</Button>
        </CardContent>
      </Card>
    </div>
  );
}
