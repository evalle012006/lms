// Masks a government ID number to its last 4 characters (the bullets show the length, capped at 8).
export const maskId = (v) => {
    if (!v) return null;
    const s = String(v);
    return s.length <= 4 ? '••••' : '•'.repeat(Math.min(8, s.length - 4)) + s.slice(-4);
};
