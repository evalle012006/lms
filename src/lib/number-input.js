// Normalizes a number <input> value in place before it reaches state: "00" -> "0", "05" -> "5".
// React keeps the typed text of a number input when the parsed number is unchanged, so without this
// a user can end up with "00"/"000" on screen while state holds 0.
export const normalizeNumberInput = (e) => {
    const el = e?.target;
    if (el && typeof el.value === 'string' && /^-?0\d/.test(el.value)) {
        el.value = String(parseFloat(el.value));
    }
    return e;
};
