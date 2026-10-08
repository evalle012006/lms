import bcrypt from 'bcryptjs';

// Generates a random 6-digit password, staff-issued during activation or a
// reset. Deliberately the same shape as an OTP code (easy for a client to
// read off a slip of paper and type once) — but unlike an OTP, this becomes
// their actual password until they change it themselves in the app.
export function generateInitialPassword() {
    const plain = String(Math.floor(100000 + Math.random() * 900000));
    const hash = bcrypt.hashSync(plain, bcrypt.genSaltSync(10));
    return { plain, hash };
}