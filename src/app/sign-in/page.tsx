"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions";
import { ArrowRight, Wordmark } from "@/components/Wordmark";

/**
 * The returning half of authentication.
 *
 * Deliberately plain. A person signing in already knows what this product is,
 * and everything interesting about the flow happens before an account exists.
 */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await signIn(email, password);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSignedIn(true);
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full justify-center pt-6">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md animate-rise text-center">
          <h1 className="display-lg text-on-surface">Welcome back</h1>
          <p className="body-lg mt-3 text-on-surface-variant">
            Pick up where you left off.
          </p>

          {signedIn ? (
            <p className="body-md mt-10 rounded-[12px] border border-outline-variant/60 bg-surface-container-lowest/60 p-6 text-on-surface-variant">
              Signed in. The console arrives with the next feature — for now,
              there is nowhere to send you.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-10 space-y-6 text-left" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="label-caps block text-on-surface-variant"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="field mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="label-caps block text-on-surface-variant"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="field mt-2"
                />
              </div>

              {message ? (
                <p className="animate-fade text-sm text-error">{message}</p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="btn-primary headline-sm w-full text-base"
              >
                <span>{pending ? "Checking…" : "Sign in"}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          )}

          <p className="body-md mt-8 text-on-surface-variant">
            Starting a memoir instead?{" "}
            <Link
              href="/onboarding/about"
              className="text-primary underline underline-offset-4"
            >
              Begin their story
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
