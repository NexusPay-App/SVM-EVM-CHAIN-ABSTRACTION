const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('NexusDeFi Backend is running!');
});

// TODO: Implement authentication and wallet management routes

app.listen(port, () => {
  console.log(`NexusDeFi Backend listening at http://localhost:${port}`);
}); 