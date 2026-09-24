// Runs Leave Logs locally: serves index.html and the API from app.js.
// Start with `npm start`, then open http://localhost:3000 (or the PORT in .env).

const path = require('path');
const app = require('./app');

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, err => {
	if (err) {
		console.error('Could not start on port ' + port + ': ' + err.message +
			(err.code === 'EADDRINUSE' ? '\nAnother program is using it. Set a different PORT in .env.' : ''));
		process.exit(1);
	}
	console.log('Leave Logs running at http://localhost:' + port);
});
