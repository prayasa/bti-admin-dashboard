"use client";

import {
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasAdminRole } from "@/lib/auth";
import { supabase } from "@/src/utils/supabase";

interface LoginFormProps {
  redirectTo: string;
}

function getAuthenticationErrorMessage(status?: number) {
  switch (status) {
    case 400:
      return "Email atau kata sandi tidak sesuai.";
    case 422:
      return "Format email atau kata sandi tidak valid.";
    case 429:
      return "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba kembali.";
    default:
      return "Login gagal. Periksa koneksi dan coba kembali.";
  }
}

export function LoginForm({
  redirectTo,
}: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage(
        "Email dan kata sandi wajib diisi.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (loginError) {
      console.error("Login Supabase gagal:", {
        status: loginError.status,
        code: loginError.code,
      });

      setErrorMessage(
        getAuthenticationErrorMessage(
          loginError.status,
        ),
      );
      setIsSubmitting(false);
      return;
    }

    const {
      data: claimsData,
      error: claimsError,
    } = await supabase.auth.getClaims();

    if (
      claimsError ||
      !hasAdminRole(claimsData?.claims)
    ) {
      await supabase.auth.signOut({
        scope: "local",
      });

      setErrorMessage(
        "Akun ini tidak memiliki hak akses administrator.",
      );
      setIsSubmitting(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="admin-email">
          Email administrator
        </Label>

        <Input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrorMessage("");
          }}
          placeholder="admin@bti.co.id"
          autoComplete="email"
          inputMode="email"
          className="h-10"
          disabled={isSubmitting}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">
          Kata sandi
        </Label>

        <div className="relative">
          <Input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Masukkan kata sandi"
            autoComplete="current-password"
            className="h-10 pr-11"
            disabled={isSubmitting}
            required
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
            onClick={() =>
              setShowPassword((current) => !current)
            }
            disabled={isSubmitting}
            aria-label={
              showPassword
                ? "Sembunyikan kata sandi"
                : "Tampilkan kata sandi"
            }
          >
            {showPassword ? (
              <EyeOff
                className="size-4"
                aria-hidden="true"
              />
            ) : (
              <Eye
                className="size-4"
                aria-hidden="true"
              />
            )}
          </Button>
        </div>
      </div>

      <div
        className={
          errorMessage
            ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-5 text-destructive"
            : "hidden"
        }
        role="alert"
        aria-live="polite"
      >
        {errorMessage}
      </div>

      <Button
        type="submit"
        className="h-10 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <LoaderCircle
            className="size-4 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <LogIn
            className="size-4"
            aria-hidden="true"
          />
        )}

        {isSubmitting
          ? "Memverifikasi..."
          : "Masuk ke dashboard"}
      </Button>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Akses hanya tersedia untuk akun internal dengan
        role administrator.
      </p>
    </form>
  );
}