import { createContext, useContext } from "react";

/**
 * Provides a pre-resolved urlMap to AvatarCell so it doesn't need
 * to call useSignedUrl individually per row.
 *
 * Value shape: Record<storageKey, signedUrl>
 */
export const SignedUrlContext = createContext({});

export function useSignedUrlMap() {
  return useContext(SignedUrlContext);
}