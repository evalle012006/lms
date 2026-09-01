import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '@/redux/actions/userActions';
import { toast } from 'react-toastify';
import { useBiometric, isBiometricSupported } from '@/hooks/useBiometric';
import { userService } from '@/services/user-service';
import Image from 'next/image';
import logo from '/public/images/logo.png';

const BiometricSetupPage = () => {
    const router      = useRouter();
    const dispatch     = useDispatch();
    const currentUser = useSelector(s => s.user.data);
    const { registerBiometric, loading } = useBiometric();
    const registeringRef = useRef(false);

    const [done, setDone] = useState(false);

    const handleSkip = () => {
        try {
            // CHANGED: source from Redux `currentUser` instead of re-reading
            // localStorage. At this point in the flow, Redux is the freshest,
            // correct copy (e.g. mustChangePassword:false if a forced change
            // was just completed) — re-parsing localStorage.acuser here risked
            // dispatching a stale or differently-shaped blob back into Redux
            // and silently reverting fields another page had just corrected.
            const stored = { ...currentUser, biometricSkipped: true };
            localStorage.setItem('acuser', JSON.stringify(stored));
            // loginDirect calls userSubject.next({ success: true, user })
            // which is what RouteGuard reads via userService.userValue
            userService.loginDirect(stored);
            dispatch(setUser(stored));
        } catch (e) { /* ignore */ }
        router.push('/');
    };

    // ── Redirect if already registered ─────────────────────────────────
    useEffect(() => {
        if (currentUser?.biometricCredentialId) {
            router.replace('/');
        }
    }, [currentUser]);

    const detectDeviceName = () => {
        if (typeof navigator === 'undefined') return 'My Device';
        const ua = navigator.userAgent;
        if (/iPhone/.test(ua))  return 'iPhone';
        if (/iPad/.test(ua))    return 'iPad';
        if (/Android/.test(ua)) return 'Android Device';
        if (/Mac/.test(ua))     return 'Mac';
        if (/Windows/.test(ua)) return 'Windows PC';
        return 'My Device';
    };

    // Detect if likely mobile
    const isMobile = () => {
        if (typeof navigator === 'undefined') return false;
        return /iPhone|iPad|Android/i.test(navigator.userAgent);
    };

    const handleRegister = async () => {
        if (!currentUser?._id) return;
        if (registeringRef.current) return;
        registeringRef.current = true;

        const name   = detectDeviceName();
        const result = await registerBiometric(currentUser._id, name);

        registeringRef.current = false;

        if (result.success) {
            setDone(true);
            toast.success('Biometric registered! Redirecting...');
            // Update localStorage, userService BehaviorSubject AND Redux
            // RouteGuard re-runs when Redux userState changes — must update all three
            try {
                const stored = JSON.parse(localStorage.getItem('acuser') || '{}');
                stored.biometricCredentialId = 'registered';
                localStorage.setItem('acuser', JSON.stringify(stored));
                userService.update(stored);      // updates BehaviorSubject
                dispatch(setUser(stored));        // updates Redux → triggers RouteGuard re-check
            } catch (e) { /* ignore */ }
            setTimeout(() => router.push('/'), 1800);
        } else if (!result.cancelled) {
            toast.error(result.error || 'Registration failed. Please try again.');
        }
    };

    const biometricLabel = isMobile()
        ? /iPhone|iPad/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
            ? 'Use Face ID / Touch ID'
            : 'Scan Fingerprint'
        : 'Scan Fingerprint';

    const benefits = ['Faster login', 'More secure', 'No password needed'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50
            flex flex-col items-center justify-center px-4 py-8">

            {/* Blobs — desktop only */}
            <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-teal-100 rounded-full opacity-30 blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-100 rounded-full opacity-30 blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm md:max-w-md">
                <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl md:shadow-2xl
                    border border-gray-100 px-6 py-8 md:p-10">

                    {/* Logo */}
                    <div className="flex justify-center mb-5">
                        <Image src={logo} alt="AmberCash" width={56} height={56}
                            className="rounded-2xl shadow-md" />
                    </div>

                    {done ? (
                        /* ── Success ─────────────────────────────────── */
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center
                                justify-center mx-auto">
                                <svg className="w-8 h-8 text-teal-600" fill="none"
                                    stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                        strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">All set!</h2>
                            <p className="text-sm text-gray-500">
                                Biometric registered. Redirecting to dashboard...
                            </p>
                            <div className="flex justify-center mt-2">
                                <svg className="w-5 h-5 animate-spin text-teal-500" fill="none"
                                    viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                            </div>
                        </div>
                    ) : (
                        /* ── Setup form ──────────────────────────────── */
                        <>
                            {/* Header */}
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center
                                    justify-center mx-auto mb-4">
                                    {/* Fingerprint icon */}
                                    <svg className="w-8 h-8 text-teal-600" fill="none"
                                        stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                    </svg>
                                </div>
                                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                                    Set Up Biometric Login
                                </h2>
                                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                                    {isMobile()
                                        ? 'Use your fingerprint or Face ID to sign in faster.'
                                        : 'Use your fingerprint or Windows Hello to sign in faster.'
                                    }
                                </p>
                            </div>

                            {/* Benefit pills */}
                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                {benefits.map(b => (
                                    <span key={b} className="px-3 py-1 bg-teal-50 text-teal-700
                                        text-xs font-medium rounded-full border border-teal-200">
                                        ✓ {b}
                                    </span>
                                ))}
                            </div>

                            {isBiometricSupported() ? (
                                <>
                                    {/* Instruction hint */}
                                    <div className="mb-5 p-3 bg-blue-50 border border-blue-100
                                        rounded-xl text-center">
                                        <p className="text-xs text-blue-700 leading-relaxed">
                                            {isMobile()
                                                ? '👆 Your phone will prompt you to scan your fingerprint or use Face ID when you tap the button below.'
                                                : '🖥️ Your browser will open a fingerprint or Windows Hello prompt when you click the button below.'
                                            }
                                        </p>
                                    </div>

                                    {/* Big tap target for mobile */}
                                    <button
                                        type="button"
                                        onClick={handleRegister}
                                        disabled={loading}
                                        className="w-full py-4 px-4 bg-teal-600 text-white
                                            text-base font-semibold rounded-2xl
                                            hover:bg-teal-700 active:scale-95
                                            disabled:opacity-50 transition-all duration-200
                                            flex items-center justify-center gap-3
                                            shadow-lg shadow-teal-200"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="w-5 h-5 animate-spin" fill="none"
                                                    viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12"
                                                        r="10" stroke="currentColor" strokeWidth="4"/>
                                                    <path className="opacity-75" fill="currentColor"
                                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                                </svg>
                                                Waiting for biometric...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 flex-shrink-0" fill="none"
                                                    stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round"
                                                        strokeWidth={1.5}
                                                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                                </svg>
                                                {biometricLabel}
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                /* Not supported */
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl
                                    text-center">
                                    <p className="text-sm font-semibold text-amber-800 mb-1">
                                        Not supported on this browser
                                    </p>
                                    <p className="text-xs text-amber-600 leading-relaxed">
                                        Use Chrome or Safari on a device with a fingerprint scanner or Face ID.
                                        On desktop, use Chrome with Windows Hello or Touch ID.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/')}
                                        className="mt-4 w-full py-3 text-sm font-medium
                                            bg-white border border-amber-300 text-amber-700
                                            rounded-xl hover:bg-amber-50 transition-colors"
                                    >
                                        Continue without biometric
                                    </button>
                                </div>
                            )}

                            {/* LO warning — rep > 3 means Loan Officer */}
                            {currentUser?.role?.rep > 3 && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <p className="text-xs font-semibold text-amber-800">
                                        ⚠ Loan approval requires biometric
                                    </p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        You will not be able to approve loan disbursements
                                        without a registered fingerprint.
                                    </p>
                                </div>
                            )}

                            {/* Skip button */}
                            <button
                                type="button"
                                onClick={handleSkip}
                                disabled={loading}
                                className="mt-3 w-full py-3 text-sm font-medium rounded-xl
                                    border border-gray-200 text-gray-500
                                    hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                                Skip for now
                            </button>

                            <p className="text-center text-xs text-gray-300 mt-5 leading-relaxed">
                                Your biometric never leaves this device.{'\n'}
                                Only a secure key is stored on our servers.
                            </p>
                        </>
                    )}
                </div>

                {/* Greeting */}
                {!done && currentUser && (
                    <p className="text-center text-xs text-gray-400 mt-4">
                        Signed in as <span className="font-medium text-gray-500">
                            {currentUser.firstName} {currentUser.lastName}
                        </span>
                    </p>
                )}
            </div>
        </div>
    );
};

export default BiometricSetupPage;