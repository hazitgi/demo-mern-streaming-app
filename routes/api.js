const router = require("express").Router();
const twilio = require("twilio");
const crypto = require("crypto");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require("twilio")(accountSid, authToken);



router.get("/", async (req, res) => {
  client.video.rooms
    .create({ type: "go", uniqueName: "My First Video Room" })
    .then((room) => console.log(room))
    .catch((error) => {
      console.log(error);
    });
});

module.exports = router;
