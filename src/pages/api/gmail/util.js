export const generateConfig = (url, accessToken, method = "get") => {
    return {
        method: method,
        url: url,
        headers: {
            Authorization: `Bearer ${accessToken} `,
            "Content-type": "application/json",
        },
    };
};