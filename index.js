const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("PeTora Server is Running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
