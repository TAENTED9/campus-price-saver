/**
 * Quantity input for listing forms.
 *
 * Block 3 (Quantity Input Fix): purpose-built to match the brief —
 *   - Click/focus selects the existing value so typing a digit REPLACES it.
 *   - Proper `type="number"` input (not text-with-validation).
 *   - inputMode="numeric" so mobile shows the digit keypad.
 *   - Hard min=1, integer-only (no decimals).
 *   - Field can be left empty while editing; on blur, empty defaults to `min`.
 *   - Optional visible +/- buttons that never go below `min`.
 *
 * Why not just reuse <NumberInput>? Because <NumberInput> is a text input
 * with comma formatting (intentional, for currency). Quantity values are
 * tiny integers, never need commas, and benefit from native number-input
 * semantics (min, mobile keypad behavior, step buttons).
 */
"use client";

import { forwardRef, useCallback, useState } from "react";
import { Minus, Plus } from "lucide-react";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max" | "step"
> & {
  value: number | "" | null | undefined;
  onValueChange: (value: number) => void;
  /** Minimum allowed value. Defaults to 1. */
  min?: number;
  /** Maximum allowed value. Defaults to 9999. */
  max?: number;
  /** Show ± buttons either side of the input. Defaults to true. */
  showSteppers?: boolean;
};

const QuantityInput = forwardRef<HTMLInputElement, Props>(function QuantityInput(
  {
    value,
    onValueChange,
    min = 1,
    max = 9999,
    showSteppers = true,
    onFocus,
    onBlur,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  // The input is allowed to be empty while the user is mid-edit; we only
  // re-clamp on blur. `localText` lets us track that empty state without
  // forcing the parent's `value` state to accept "".
  const [localText, setLocalText] = useState<string | null>(null);

  const display = localText !== null
    ? localText
    : (value === "" || value == null || Number.isNaN(value)) ? "" : String(value);

  const clamp = useCallback(
    (n: number) => Math.min(max, Math.max(min, Math.floor(n))),
    [min, max],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Empty is allowed transiently — re-resolved on blur.
    if (raw === "") {
      setLocalText("");
      return;
    }
    // Strip everything that isn't a digit. `type="number"` already filters
    // most non-numeric input, but this is a belt-and-braces guard.
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits === "") {
      setLocalText("");
      return;
    }
    const num = Number(digits);
    if (Number.isNaN(num)) return;
    setLocalText(digits);
    onValueChange(clamp(num));
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.select();
    if (onFocus) onFocus(e);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (localText === "" || (typeof value === "number" && value < min)) {
      onValueChange(min);
    }
    setLocalText(null); // hand display back to the parent's `value`
    if (onBlur) onBlur(e);
  }

  function step(direction: -1 | 1) {
    const base = typeof value === "number" && !Number.isNaN(value) ? value : min;
    onValueChange(clamp(base + direction));
    setLocalText(null);
  }

  if (!showSteppers) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        min={min}
        max={max}
        step={1}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
        disabled={disabled}
        {...rest}
      />
    );
  }

  // Stepper layout: input keeps its incoming className so it slots into the
  // form's normal spacing; the buttons sit at either edge as an absolute
  // overlay so the input keeps full width for the typed value.
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => step(-1)}
        disabled={disabled || (typeof value === "number" && value <= min)}
        className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={14} />
      </button>
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        min={min}
        max={max}
        step={1}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`${className ?? ""} text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]`}
        disabled={disabled}
        {...rest}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => step(1)}
        disabled={disabled || (typeof value === "number" && value >= max)}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
});

export default QuantityInput;
