const { google } = require("googleapis");

const CLIENT_ID="542005036498-g309h2p0t7gs401i6d551j7ir8la31j0.apps.googleusercontent.com"
const CLIENT_SECRET="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"
const REDIRECT_URI="https://developers.google.com/oauthplayground"
const REFRESH_TOKEN="1//04xfbpC9XwX08CgYIARAAGAQSNwF-L9Irc6muE0ZccEkfKiv0qA4yVMF-nvwpOVvdv6_ccnp3wl6WMGf8mrOzk3ubG3bIrk_ATTI"

const oAuth2Client = new google.auth.OAuth2(
    // process.env.CLIENT_ID,
    // process.env.CLIENT_SECRET,
    // process.env.REDIRECT_URL,
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

let googleAuth;

export default async function handler(req, res) {
    const auth = oAuth2Client.setCredentials({
        refresh_token: REFRESH_TOKEN
    });

    console.log(auth)

    const data = {
        message: 'This is a test message'
    }

    res.status(200).json(data);
}