import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { register } from "@/lib/api";
import { Workflow } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z.object({
  email: z.email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Password must contain at least one special character",
    }),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const { login, isLoading, error } = useAuthStore();
  const [localError, setLocalError] = useState("");
  const navigate = useNavigate();

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: FormData) => {
    setLocalError("");
    try {
      if (isRegister) {
        await register(data.email, data.password);
        toast.success("Account created successfully");
      }
      await login(data.email, data.password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setLocalError(msg);
      toast.error(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background)",
      }}
    >
      <div
        style={{
          width: 420,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "24px",
          padding: 48,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))",
              borderRadius: "var(--radius-md)",
              padding: 10,
              display: "flex",
              boxShadow: "0 4px 12px var(--color-accent-glow)",
            }}
          >
            <Workflow size={24} color="white" />
          </div>
          <span
            style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}
          >
            Sentient Flow
          </span>
        </div>

        <h2
          style={{
            textAlign: "center",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--color-text-secondary)",
            margin: "0 0 32px",
          }}
        >
          {isRegister
            ? "Create your account to start building"
            : "Welcome back, please log in"}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              {...formRegister("email")}
              style={inputStyle}
            />
            {errors.email && (
              <span
                style={{
                  color: "var(--color-error)",
                  fontSize: 12,
                  marginTop: 4,
                  display: "block",
                }}
              >
                {errors.email.message}
              </span>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              {...formRegister("password")}
              style={inputStyle}
            />
            {errors.password && (
              <span
                style={{
                  color: "var(--color-error)",
                  fontSize: 12,
                  marginTop: 4,
                  display: "block",
                }}
              >
                {errors.password.message}
              </span>
            )}
          </div>

          {(error || localError) && (
            <div
              style={{
                background: "var(--color-error)15",
                border: "1px solid var(--color-error)33",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                marginBottom: 16,
                fontSize: 13,
                color: "var(--color-error)",
              }}
            >
              {localError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: isLoading
                ? "var(--color-surface-active)"
                : "var(--color-text-primary)",
              color: "var(--color-background)",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading ? "wait" : "pointer",
              transition: "transform 0.1s, opacity 0.2s",
              marginTop: 12,
            }}
          >
            {isLoading
              ? "Loading..."
              : isRegister
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
          <span style={{ color: "var(--color-text-muted)" }}>
            {isRegister ? "Already have an account?" : "Don't have an account?"}
          </span>{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setLocalError("");
              reset(); // Clear all validation errors when switching modes
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-accent)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {isRegister ? "Login" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text-primary)",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--color-background)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-text-primary)",
  fontSize: 15,
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};
