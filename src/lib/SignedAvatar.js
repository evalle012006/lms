/**
 * SignedAvatar.js
 *
 * Drop-in replacement for <Avatar> that handles storage keys and legacy
 * DO Spaces URLs. Resolves the key to a signed URL before passing to Avatar.
 *
 * Usage:
 *   import SignedAvatar from '@/lib/SignedAvatar';
 *   <SignedAvatar name={client.fullName} src={client.profile} size={50} />
 *
 * Props: identical to Avatar — just swap the import.
 */

import { useSignedUrl } from "hooks/useSignedUrl";
import Avatar from "./avatar";



const SignedAvatar = ({ src, ...rest }) => {
  const { signedUrl } = useSignedUrl(src);
  // signedUrl is null while loading → Avatar shows initials until resolved
  return <Avatar src={signedUrl || undefined} {...rest} />;
};

export default SignedAvatar;