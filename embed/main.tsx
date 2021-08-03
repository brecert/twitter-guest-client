import h from "https://cdn.skypack.dev/vhtml?dts";
const React = { createElement: h };

import {
  listenAndServe,
  Response,
  ServerRequest,
} from "https://deno.land/std@0.101.0/http/server.ts";
import { parse } from "https://deno.land/std@0.103.0/flags/mod.ts";
import * as Twitter from "../twitter.ts";

// Warning: This code is unfished and rather ugly and poorly designed

export interface ServerArgs {
  _: string[];

  // --host
  // the hostname
  host?: string;

  // -p --port
  p?: number;
  port?: number;
}

const serverArgs = parse(Deno.args) as ServerArgs;

type RequestHandler = (
  req: ServerRequest,
  url: URL,
  client: Twitter.GuestClient,
) => Promise<Response>;

function main() {
  const proto = "http";

  const port = serverArgs.port ?? serverArgs.p ?? 8574;
  const host = serverArgs.host ?? "0.0.0.0";
  const addr = `${host}:${port}`;
  const base = `${proto}://${addr}`;
  const client = new Twitter.GuestClient("Embedded Twitter Videos");

  const handleRequest: RequestHandler = async (req, url, client) => {
    if (url.pathname === "/oembed.json") {
      const username = url.searchParams.get("username");

      if (username != null) {
        const data = await client.getProfile(username);
        const profile = data.user.legacy;

        return {
          status: 200,
          headers: new Headers({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            thumbnail_url: profile.profile_image_url_https,
            thumbnail_width: 73,
            thumbnail_height: 73,
            "author_name": `${profile.name} (@${profile.screen_name})`,
            "author_url": profile.url ??
              `https://twitter.com/${profile.screen_name}`,
            "type": "video",
            "version": "1.0",
          }),
        };
      }
    } else {
      const status = url.pathname.match(/\/\w+\/status\/(\d+)/);
      if (status) {
        const [_, tweetId] = status;
        const tweet = await client.getTweet(tweetId);
        const video = Twitter.getVideos(tweet)?.[0];

        if (video) {
          const videoInfo = Twitter.getVideoInfo(video);
          const username = video.expanded_url.split("/")[3];

          const meta = {
            description: tweet.full_text,
            type: "video",
            url: video.url,
            title: video.url,
            video: videoInfo.url,
            "video:type": videoInfo.content_type,
            "video:width": video.sizes.large.w,
            "video:height": video.sizes.large.h,
            "video:secure_url": videoInfo.url,
            image: tweet.entities.media[0].media_url_https,
          } as const;

          const twitterMeta = {
            "twitter:card": "player",
            "twitter:title": meta.title,
            "twitter:image": meta.image,
            "twitter:player": meta.video,
            "twitter:player:width": meta["video:width"],
            "twitter:player:height": meta["video:height"],
            "twitter:player:stream": meta.video,
            "twitter:player:stream:content_type": meta["video:type"],
            "twitter:description": meta.description,
          } as const;

          const ogpMeta = Object.entries(meta).map(([k, v]) =>
            <meta property={`og:${k}`} content={`${v}`} />
          );
          const twtMeta = Object.entries(twitterMeta).map(([k, v]) =>
            <meta property={k} content={`${v}`} />
          );

          const base = `${proto}://${req.headers.get("host")}`;

          return {
            headers: new Headers({
              "Content-Type": "text/html",
            }),
            body:
              <html>
                <title></title>
                <meta name="theme-color" content="#1da0f2" />
                <meta charset="utf-8" />
                {twtMeta}
                {ogpMeta}
                <link rel="alternate" href={`${base}/oembed.json?username=${username}`} type="application/json+oembed" title={username} />
              </html>,
          };
        }
      }
    }

    return {
      status: 404,
    };
  };

  listenAndServe(addr, (req) => {
    const url = new URL(req.url, base);
    handleRequest(req, url, client)
      .then((res) => req.respond(res))
      .catch((err) => {
        console.error({ err });
        if (err instanceof Twitter.TwitterErrorList) {
          req.respond({
            body: err.message,
            status: 502,
          });
        } else {
          req.respond({
            status: 400,
          });
        }
      });
  });

  console.log(`${proto.toUpperCase()} server listening on ${proto}://${addr}/`);
}

if (import.meta.main) {
  main();
}
