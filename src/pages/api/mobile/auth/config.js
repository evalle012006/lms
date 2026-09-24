import { clientApiHandler } from '@/services/client-api-handler';
import { isPasswordLoginEnabled } from '@/lib/password-login-settings';

export default clientApiHandler({ get: getConfig });

async function getConfig(req, res) {
    try {
        const passwordLoginEnabled = await isPasswordLoginEnabled();
        return res.status(200).json({ success: true, passwordLoginEnabled });
    } catch (error) {
        console.error('mobile config error:', error);
        // Fail closed on the client's assumption too — if this endpoint is
        // having trouble, don't advertise a login method that might not work.
        return res.status(200).json({ success: true, passwordLoginEnabled: false });
    }
}