import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import clsx from "clsx";
import { useAuthStore } from "@/stores/authStore";
import { register } from "@/lib/api";
import { passwordSchema } from "@/lib/validation";
import { Btn, CodeInput, Field, TextInput } from "@/components/common/controls";

const loginSchema = z.object({
  email: z.email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const registerSchema = z.object({
  email: z.email({ message: "Invalid email address" }),
  password: passwordSchema,
});

type FormData = z.infer<typeof registerSchema>;

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { login, verifyTwoFactor, isLoading } = useAuthStore();
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const isRegister = mode === "register";

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (token && !challenge) return <Navigate to="/" replace />;

  const onSubmit = async (data: FormData) => {
    setFormError("");
    try {
      if (isRegister) {
        await register(data.email, data.password);
        toast.success("Account created");
      }
      const { challengeToken } = await login(data.email, data.password);
      if (challengeToken) {
        setChallenge(challengeToken);
        setCode("");
        return;
      }
      navigate("/");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const onVerify = async () => {
    if (!challenge || code.length !== 6) return;
    setFormError("");
    try {
      await verifyTwoFactor(challenge, code);
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setFormError(msg);
      setCode("");
      // The challenge token is short-lived; send the user back to sign in again
      if (/expired/i.test(msg)) setChallenge(null);
    }
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setFormError("");
    reset();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Soft brand glow */}
      <div className="pointer-events-none absolute top-[-20%] left-1/2 h-120 w-180 -translate-x-1/2 rounded-full bg-node-trigger/10 blur-[120px]" />

      <div className="relative w-full max-w-95">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/favicon.svg" alt="" width={40} height={40} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              {challenge ? "Two-factor authentication" : isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              {challenge
                ? "Enter the 6-digit code from your authenticator app"
                : isRegister
                  ? "Start building automations with Sentient Flow"
                  : "Sign in to continue to Sentient Flow"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2e2e33] bg-surface/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur">
          {challenge ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onVerify();
              }}
              className="space-y-4"
            >
              <div className="flex justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-node-trigger/10 text-node-trigger">
                  <ShieldCheck size={20} />
                </div>
              </div>
              <Field label="Authentication code" htmlFor="login-code">
                <CodeInput id="login-code" value={code} onChange={setCode} autoFocus />
              </Field>
              {formError && <ErrorBanner message={formError} />}
              <Btn type="submit" loading={isLoading} disabled={code.length !== 6} className="h-10 w-full text-[13px]">
                Verify
              </Btn>
              <button
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setFormError("");
                }}
                className="flex w-full items-center justify-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300"
              >
                <ArrowLeft size={12} /> Back to sign in
              </button>
            </form>
          ) : (
            <>
              {/* Mode switch */}
              <div className="mb-5 grid grid-cols-2 rounded-lg border border-[#2e2e33] bg-background p-0.5">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={clsx(
                      "h-8 rounded-md text-[12px] transition-colors",
                      mode === m ? "bg-surface-hover font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {m === "login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <Field label="Email" htmlFor="email" error={errors.email?.message}>
                  <TextInput
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    invalid={!!errors.email}
                    className="h-10"
                    {...formRegister("email")}
                  />
                </Field>
                <Field
                  label="Password"
                  htmlFor="password"
                  error={errors.password?.message}
                  hint={isRegister ? "8+ characters with upper & lowercase, a number and a symbol." : undefined}
                >
                  <TextInput
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    invalid={!!errors.password}
                    className="h-10"
                    {...formRegister("password")}
                  />
                </Field>

                {formError && <ErrorBanner message={formError} />}

                <Btn type="submit" loading={isLoading} className="h-10 w-full text-[13px]">
                  {isRegister ? "Create account" : "Sign in"}
                </Btn>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
      {message}
    </div>
  );
}
