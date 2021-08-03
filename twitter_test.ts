import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";

import * as Twitter from "./twitter.ts";

const twitter = new Twitter.GuestClient("twitter-guest-client (test)");

Deno.test("getTweet#videos", async () => {
  let tweet, videos;

  // Actual Video
  tweet = await twitter.getTweet(
    "1395363681790136323",
  );
  assertExists(tweet);

  // Animated Gif
  tweet = await twitter.getTweet(
    "1395769820692377601",
  );

  videos = Twitter.getVideos(tweet);
  assertExists(videos)

  const videoInfo = Twitter.getVideoInfo(videos![0])

  assertEquals(
    videoInfo.url,
    "https://video.twimg.com/tweet_video/E17FCpeVkAYJO2I.mp4",
  );

  // No videos
  tweet = await twitter.getTweet(
    "1395032697597087746",
  );

  videos = await Twitter.getVideos(tweet);
  assertEquals(videos, []);

  // Invalid
  try {
    tweet = await twitter.getTweet("0");
    assert(false, "Expected error.");
  } catch (err) {
    assertEquals(err instanceof Twitter.TwitterErrorList, true);
    assertEquals(err.errors[0] instanceof Twitter.TwitterError, true);
  }
});
