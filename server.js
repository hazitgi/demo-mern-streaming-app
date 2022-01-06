const express = require("express");
const http = require("http");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/static", express.static("public"));

app.use("/", require("./routes/streamRoute"));
app.use("/api", require("./routes/api"));

server.listen(PORT, (err) => {
  if (err) {
    throw err;
  }
  console.log(`server running on http://localhost:${PORT}`);
});
