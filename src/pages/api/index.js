export default (req, res) => {
    const response = {
        response: 'API Connection Created'
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
}