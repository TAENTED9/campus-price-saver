"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff } from "lucide-react";

export default function SignInForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Please enter your matric number or username.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.user_role === "admin") {
        router.push("/admin");
      } else if (res.user_role === "seller") {
        router.push("/seller");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[570px] w-full mx-auto rounded-xl bg-white shadow-md p-4 sm:p-7 xl:p-11 dark:bg-gray-800">
      {/* Centered heading */}
      <div className="text-center mb-8">
        <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
          Sign In to Your Account
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Enter your details below</p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Matric / Username */}
        <div className="mb-5">
          <label htmlFor="username" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Matric Number / Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="e.g. 190101001"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="rounded-full border border-gray-300 bg-gray-50 placeholder:text-gray-400 w-full py-3 px-5 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">UNILAG matric: 9 digits (year + faculty + dept + serial)</p>
        </div>

        {/* Password */}
        <div className="mb-5">
          <label htmlFor="password" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-full border border-gray-300 bg-gray-50 placeholder:text-gray-400 w-full py-3 px-5 pr-12 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center font-medium text-white bg-gray-900 py-3 px-6 rounded-full ease-out duration-200 hover:bg-brand-500 mt-6 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-brand-500"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>

        {/* Forgot password */}
        <Link
          href="/forgot-password"
          className="block text-center text-gray-400 mt-4 text-sm ease-out duration-200 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Forgot your password?
        </Link>
      </form>

      {/* Sign up link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
