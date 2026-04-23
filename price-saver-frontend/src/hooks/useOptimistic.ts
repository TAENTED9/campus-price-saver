"use client";

/**
 * Block 13D — Generic optimistic-update helper.
 *
 * Pattern:
 *   1. Immediately apply the update to local state (optimistic)
 *   2. Call the async action
 *   3. If it rejects, revert to the previous state
 *
 * Usage:
 *   const [wishlisted, toggleWishlist] = useOptimistic(
 *     false,
 *     async (next) => { await api.setWishlist(listingId, next); }
 *   );
 */

import { useState, useCallback } from "react";

export function useOptimistic<T>(
  initial: T,
  asyncAction: (optimisticValue: T) => Promise<void>
): [T, (next: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [pending, setPending] = useState(false);

  const update = useCallback(
    async (next: T) => {
      const prev = value;
      setValue(next); // optimistic
      setPending(true);
      try {
        await asyncAction(next);
      } catch {
        setValue(prev); // revert on error
      } finally {
        setPending(false);
      }
    },
    [value, asyncAction]
  );

  return [value, update, pending];
}

/**
 * Optimistic boolean toggle (most common case).
 * Accepts the current server-truth value and flips it on call.
 *
 * Usage (wishlist heart):
 *   const [saved, toggle, busy] = useOptimisticToggle(
 *     isWishlisted,
 *     async (next) => next ? await addToWishlist(id) : await removeFromWishlist(id)
 *   );
 */
export function useOptimisticToggle(
  serverValue: boolean,
  asyncAction: (nextValue: boolean) => Promise<void>
): [boolean, () => Promise<void>, boolean] {
  const [value, setValue] = useState(serverValue);
  const [pending, setPending] = useState(false);

  const toggle = useCallback(async () => {
    const prev = value;
    const next = !prev;
    setValue(next); // optimistic flip
    setPending(true);
    try {
      await asyncAction(next);
    } catch {
      setValue(prev); // revert
    } finally {
      setPending(false);
    }
  }, [value, asyncAction]);

  return [value, toggle, pending];
}
