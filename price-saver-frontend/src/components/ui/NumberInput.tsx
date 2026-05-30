"use client";

import React, { forwardRef, useMemo } from "react";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number | "" | null | undefined;
  onValueChange: (value: number | "") => void;
  /** Allow decimal digits (default false — integer-only, e.g. ₦ amounts) */
  allowDecimal?: boolean;
  /** Maximum digits the user can type (excluding separators). Default 12. */
  maxDigits?: number;
};

function formatWithCommas(raw: string, allowDecimal: boolean): string {
  if (raw === "" || raw === "-") return raw;
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [intPart, decPart] = body.split(".");
  const intFormatted = intPart === "" ? "" : Number(intPart).toLocaleString("en-US");
  let out = intFormatted;
  if (allowDecimal && body.includes(".")) {
    out = `${intFormatted}.${decPart ?? ""}`;
  }
  return negative ? `-${out}` : out;
}

const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onValueChange, allowDecimal = false, maxDigits = 12, onBlur, onFocus, ...rest },
  ref,
) {
  const display = useMemo(() => {
    if (value === "" || value == null || Number.isNaN(value)) return "";
    return formatWithCommas(String(value), allowDecimal);
  }, [value, allowDecimal]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    let cleaned = raw.replace(/,/g, "");
    if (allowDecimal) {
      cleaned = cleaned.replace(/[^\d.-]/g, "");
      const firstDot = cleaned.indexOf(".");
      if (firstDot !== -1) {
        cleaned =
          cleaned.slice(0, firstDot + 1) +
          cleaned.slice(firstDot + 1).replace(/\./g, "");
      }
    } else {
      cleaned = cleaned.replace(/[^\d-]/g, "");
    }
    if (cleaned.includes("-") && !cleaned.startsWith("-")) {
      cleaned = cleaned.replace(/-/g, "");
    }
    const digitsOnly = cleaned.replace(/[^0-9]/g, "");
    if (digitsOnly.length > maxDigits) return;

    if (cleaned === "" || cleaned === "-") {
      onValueChange("");
      return;
    }
    const num = Number(cleaned);
    if (Number.isNaN(num)) return;
    onValueChange(num);
  }

  // Block 3: select existing value on focus so typing a digit REPLACES it
  // instead of appending. Fixes the "cursor lands mid-string, user types a
  // number, gets '15' instead of '5'" pain across every consumer of this input.
  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.select();
    if (onFocus) onFocus(e);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={onBlur}
      {...rest}
    />
  );
});

export default NumberInput;
