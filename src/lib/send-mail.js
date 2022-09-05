export { sendMail };

const sendMail = async (to, subject, template, from) => {
    const nodemailer = require('nodemailer');
    let transporter = nodemailer.createTransport({
        host: process.env.NEXT_PUBLIC_EMAIL_HOST,
        port: process.env.NEXT_PUBLIC_EMAIL_PORT,
        auth: {
            user: process.env.NEXT_PUBLIC_EMAIL_USERNAME,
            pass: process.env.NEXT_PUBLIC_EMAIL_PASSWORD
        }
    });

    const response = await transporter.sendMail({
        from: from ? from : 'support@hybridag.com.au',
        to: to,
        subject: subject,
        html: template
    }, function (err, info) {
        if (err) {
            console.log('Error during sending email: ' + err)
        } else {
            return response;
        }
    });

    return response;
}