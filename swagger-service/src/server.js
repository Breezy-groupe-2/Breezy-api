const app = require('./app');

const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`📖 Swagger Service running on port ${PORT}`);
});
