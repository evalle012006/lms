export { errorHandler };

function errorHandler(err, res) {
    if (typeof (err) === 'string') {
        const is404 = err.toLowerCase().endsWith('not found!');
        const statusCode = is404 ? 404 : 400;
        return res.status(statusCode).json({ message: err });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Invalid Token' });
    }

    const errorInfo = {
      graphQLErrors: err?.graphQLErrors,
      message: err.message,
      stack: err.stack,
    }
    console.error(JSON.stringify(errorInfo, null, 2));
    return res.status(500).json({ message: err.message });
}