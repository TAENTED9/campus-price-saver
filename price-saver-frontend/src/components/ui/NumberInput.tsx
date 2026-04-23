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
  { value, onValueChange, allowDecimal = false, maxDigits = 12, onBlur, ...rest },
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

  return (
    <input
      ref={ref}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      onBlur={onBlur}
      {...rest}
    />
  );
});

export default NumberInput;
