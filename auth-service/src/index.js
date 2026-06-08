require('dotenv').config();
const express = require('express');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 4001;

app.use(express.json());
app.use('/auth', authRoutes);

sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, () => console.log(`auth-service running on port ${PORT}`));
});

module.exports = app;
