const router = require("express").Router();
const twilio = require("twilio");
const crypto = require("crypto");


const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
const PlaybackGrant = AccessToken.PlaybackGrant;

const accountSid = process.env.accountSid;
const apiKey = process.env.apiKey;
const apiKeySecret = process.env.apiKeySecret;


console.log("accountSid", accountSid);
console.log("apiKey", apiKey);
console.log("apiKeySecret", apiKeySecret);

const twilioClient = twilio(apiKey, apiKeySecret, { accountSid: accountSid });

/*
 * Start a new livestream with a video room, PlayerStreamer and Meadia Processor
 */

router.post("/start-stream", async (req, res) => {
  const { streamName } = req.body;
  try {
    // Create the WebRTC Go video room, PlayerStreamer, and MediaProcessors
    const room = await twilioClient.video.rooms.create({
      uniqueName: streamName,
      type: "group",
    });

    console.log("room", room);
    const playerStreamer = await twilioClient.media.playerStreamer.create();

    const mediaProcessor = await twilioClient.media.mediaProcessor.create({
      extension: "video-composer-v1",
      extensionContext: JSON.stringify({
        identity: "video-composer-v1",
        room: {
          name: room.sid,
        },
        outputs: [playerStreamer.sid],
      }),
    });

    console.log("======================");
    console.log("room.sid", room.sid);
    console.log("streamName", streamName);
    console.log("playerStreamer.sid", playerStreamer.sid);
    console.log("mediaProcessor.sid", mediaProcessor.sid);
    console.log("======================");

    return res.status(200).send({
      roomId: room.sid,
      streamName: streamName,
      playerStreamerId: playerStreamer.sid,
      mediaProcessorId: mediaProcessor.sid,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      message: `Unable to create livestream`,
      error,
    });
  }
});

/*
 *   End a livestream
 */
router.post("/end-stream", async (req, res) => {
  const streamDetails = req.body;

  // End the player streamer, media processor, and video room
  const streamName = streamDetails.streamName;
  const roomId = streamDetails.roomId;
  const playerStreamerId = streamDetails.playerStreamerId;
  const mediaProcessorId = streamDetails.mediaProcessorId;
  try {
    await twilioClient.media
      .mediaProcessor(mediaProcessorId)
      .update({ status: "ended" });
    await twilioClient.media
      .playerStreamer(playerStreamerId)
      .update({ status: "ended" });
    await twilioClient.video.rooms(roomId).update({ status: "completed" });

    return res.status(200).send({
      message: `Successfully ended stream ${streamName}`,
    });
  } catch (error) {
    console.log("error in end-stream", error);
    return res.status(400).send({
      message: `Unable to end stream`,
      error,
    });
  }
});

/**
 * Get an Access Token for a streamer
 */

router.post("/streamerToken", async (req, res) => {
  if (!req.body.identity || !req.body.room) {
    return res.status(400).send({ message: `Missing identity or stream name` });
  }

  // Get the user's identity and the room name from the request
  const identity = req.body.identity;
  const roomName = req.body.room;

  try {
    //   create a video grant for this specific room
    const videoGrant = new VideoGrant({
      room: roomName,
    });

    // create access token
    const token = new AccessToken(accountSid, apiKey, apiKeySecret);

    // Add the video grant and the user's identity to the token
    token.addGrant(videoGrant);
    token.identity = identity;

    console.log("/streamerToken", token);
    // Serialize the token to a JWT and return it to the client side
    return res.send({
      token: token.toJwt(),
    });
  } catch (error) {
    console.log("error in /streamerToken", error);
    return res.status(400).send({ error });
  }
});

/**
 * Get an Access Token for an audience member
 */

router.post("/audienceToken", async (req, res) => {
  // Generate a random string for the identity
  const { playerStreamerId } = req.body;
  const identity = crypto.randomBytes(20).toString("hex");

  try {
    // Get the first player streamer
    // const playerStreamerList = await twilioClient.media.playerStreamer.list({
    //   status: "started",
    // });

    const playerStreamerList = await twilioClient.media.playerStreamer.list({
      status: "started",
    });

    console.log("playerStreamerList", playerStreamerList.length);
    console.log("playerStreamerList", playerStreamerList);


    const playerStreamer = playerStreamerList.length
      ? playerStreamerList[0]
      : null;

    console.log("playerStreamer", playerStreamer);
    // If no one is streaming, return a message
    if (!playerStreamer) {
      return res.status(200).send({
        message: `No one is streaming right now`,
      });
    }

    // Otherwise create an access token with a PlaybackGrant for the livestream
    const token = new AccessToken(accountSid, apiKey, apiKeySecret);
    console.log("token ", token);

    // Create a playback grant and attach it to the access token
    const playbackGrant = await twilioClient.media
      .playerStreamer(playerStreamer.sid)
      .playbackGrant()
      .create({ ttl: 60 });
    console.log("playbackGrant", playbackGrant);

    const wrappedPlaybackGrant = new PlaybackGrant({
      grant: playbackGrant.grant,
    });

    console.log("wrappedPlaybackGrant", wrappedPlaybackGrant);

    token.addGrant(wrappedPlaybackGrant);
    token.identity = identity;

    // Serialize the token to a JWT and return it to the client side
    return res.send({
      token: token.toJwt(),
    });
  } catch (error) {
    console.log("error in audienceToken", error);
    res.status(400).send({
      message: `Unable to view livestream`,
      error,
    });
  }
});

module.exports = router;
