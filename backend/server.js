const app = require("./src/app");
const ip = require("ip");

const PORT = 3000;
const localIP = ip.address();

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server is running:");
  console.log(`Local   : http://localhost:${PORT}`);
  console.log(`Network : http://${localIP}:${PORT}`);
});

