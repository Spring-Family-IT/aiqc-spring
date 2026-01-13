import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingInvitation, setCheckingInvitation] = useState(false);
  const [invitationValid, setInvitationValid] = useState<boolean | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("token");

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Check invitation token on mount
  useEffect(() => {
    const checkInvitation = async () => {
      if (!invitationToken) return;
      
      setCheckingInvitation(true);
      try {
        const { data, error } = await supabase
          .from("invitations")
          .select("email, status, expires_at")
          .eq("token", invitationToken)
          .maybeSingle();

        if (error || !data) {
          setInvitationValid(false);
          toast({
            title: "Invalid Invitation",
            description: "This invitation link is invalid or has already been used.",
            variant: "destructive",
          });
        } else if (data.status !== "pending") {
          setInvitationValid(false);
          toast({
            title: "Invitation Used",
            description: "This invitation has already been accepted.",
            variant: "destructive",
          });
        } else if (new Date(data.expires_at) < new Date()) {
          setInvitationValid(false);
          toast({
            title: "Invitation Expired",
            description: "This invitation has expired. Please request a new one.",
            variant: "destructive",
          });
        } else {
          setInvitationValid(true);
          setInvitationEmail(data.email);
          setEmail(data.email);
        }
      } catch (error) {
        console.error("Error checking invitation:", error);
        setInvitationValid(false);
      } finally {
        setCheckingInvitation(false);
      }
    };

    checkInvitation();
  }, [invitationToken, toast]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if signing up with invitation
    if (!invitationToken || !invitationValid) {
      toast({
        title: "Invitation Required",
        description: "Sign up is by invitation only. Please contact an admin to request access.",
        variant: "destructive",
      });
      return;
    }

    // Ensure email matches invitation
    if (invitationEmail && email.toLowerCase().trim() !== invitationEmail.toLowerCase()) {
      toast({
        title: "Email Mismatch",
        description: "Please use the email address the invitation was sent to.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const validated = authSchema.parse({ email, password });
      setLoading(true);

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success!",
          description: "Account created successfully. You can now sign in.",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = authSchema.parse({ email, password });
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Sign in failed",
            description: "Invalid email or password. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign in failed",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const showSignUpTab = invitationToken && invitationValid;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Document Intelligence</CardTitle>
          <CardDescription>Sign in to compare your documents</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Invitation Status */}
          {invitationToken && (
            <div className="mb-4">
              {checkingInvitation ? (
                <Alert>
                  <AlertDescription>Checking invitation...</AlertDescription>
                </Alert>
              ) : invitationValid ? (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Valid invitation for {invitationEmail}. Please create your account.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Invalid or expired invitation. Please contact an admin for a new invite.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Tabs defaultValue={showSignUpTab ? "signup" : "signin"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup" disabled={!showSignUpTab && !invitationToken}>
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              {!invitationToken ? (
                <div className="text-center py-6 space-y-3">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold">Invitation Required</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign up is by invitation only. Please contact an administrator to request access.
                  </p>
                </div>
              ) : !invitationValid ? (
                <div className="text-center py-6 space-y-3">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <h3 className="font-semibold">Invalid Invitation</h3>
                  <p className="text-sm text-muted-foreground">
                    This invitation link is invalid, expired, or has already been used.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading || !!invitationEmail}
                    />
                    {invitationEmail && (
                      <p className="text-xs text-muted-foreground">
                        Use the email address the invitation was sent to
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
