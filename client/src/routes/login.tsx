import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/auth/auth.context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — RUCHI PerformX" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, login, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"md" | "hod" | "employee" | "vendor">("employee");

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/app/dashboard", replace: true });
    }
  }, [user, loading, navigate]);

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await login({
        username: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      toast.success("Welcome back");
      void navigate({ to: "/app/dashboard", replace: true });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Failed to sign in";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.error("Sign up is handled by admin in the new system.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-hero text-white lg:block">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_30%,rgba(120,255,200,0.3),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent shadow-elevate">
              <Activity className="h-4 w-4" />
            </span>
            RUCHI <span className="text-accent">PerformX</span>
          </Link>
          <div>
            <h2 className="text-4xl font-bold leading-tight">Make execution visible.</h2>
            <p className="mt-3 max-w-md text-white/70">Sign in to your productivity & accountability dashboard.</p>
          </div>
          <div className="text-sm text-white/50">© {new Date().getFullYear()} RUCHI PerformX</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your PerformX account.</p>
          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="mt-6 space-y-4">
                <Field label="Email / Username" name="email" type="text" required />
                <Field label="Password" name="password" type="password" required />
                <Button disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>Sign up as</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="md">Managing Director (MD)</SelectItem>
                      <SelectItem value="hod">Head of Department (HOD)</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {role === "vendor" ? (
                  <>
                    <Field label="Company / Vendor name" name="company_name" required />
                    <Field label="POC name" name="poc_name" required />
                    <Field label="Contact (phone)" name="contact" />
                    <Field label="Email / Username" name="email" type="text" required />
                    <Field label="Password" name="password" type="password" required minLength={6} />
                  </>
                ) : (
                  <>
                    <Field label="Full name" name="full_name" required />
                    <Field label="Email / Username" name="email" type="text" required />
                    <Field label="Password" name="password" type="password" required minLength={6} />
                    <Field label="Job title (optional)" name="job_title" />
                  </>
                )}

                <Button type="button" disabled={true} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 opacity-50">
                  Create account (Disabled)
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Account creation is currently managed by administrators.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={rest.name}>{label}</Label>
      <Input id={rest.name} {...rest} />
    </div>
  );
}