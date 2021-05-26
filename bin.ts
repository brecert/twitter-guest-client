import {
  assert,
  assertExists,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { TwitterClient } from "./twitter.ts";

import { readerFromStreamReader } from "https://deno.land/std@0.97.0/io/mod.ts";

const onlyDigits = (str: string) => /\d+/.test(str);

let [inputSource, outputPath] = Deno.args;

assertExists(inputSource, "No twitter url or id was provided");
// assertExists(outputPath, "Not output path was provided");

let id: string;

if (onlyDigits(inputSource)) {
  id = inputSource;
} else {
  const url = new URL(inputSource);
  assert(
    url.hostname.endsWith("twitter.com"),
    "The url provided was not a valid twitter url",
  );
  const statusRe = /^\/\w+\/status\/(\d+)$/;
  const match = url.pathname.match(statusRe);

  assertExists(match, "The url provided was not a valid twitter status url");

  id = match![1];
}

outputPath ??= `${id}.mp4`;

const twitter = new TwitterClient("Twitter Guest Client -- Cli Fetcher");

const videos = await twitter.getVideos(id);

assertExists(videos, "This tweet has no valid videos to download");

const res = await fetch(videos![0].url);
const reader = readerFromStreamReader(res.body!.getReader());

console.log(`Writing file to '${outputPath}'`);

const file = await Deno.open(outputPath, { create: true, write: true });
await Deno.copy(reader, file);
file.close();
