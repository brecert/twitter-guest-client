import * as Twitter from "../twitter.ts";

const twitter = new Twitter.GuestClient("Embedded Twitter Videos");

// const profile = await twitter.getProfile('rapparu')
// console.log(
//   profile.data.user.legacy.entities.description.urls,
//   profile.data.user.legacy.entities.url.urls,
//   profile.data.user.legacy.profile_banner_extensions.mediaColor.r.ok.palette,
//   profile.data.user.legacy.profile_image_extensions.mediaColor.r.ok.palette,
// )

// Deno.writeTextFileSync('example.json', JSON.stringify(tweet, null, 4))

const parseTwitterPath = (url: string) => {
  const [_, _name, status, id] = url.split("/");
  if (status === "status") {
    return id.match(/^(\d+)/)?.[1];
  }
};

import { serve } from "https://deno.land/std@0.101.0/http/server.ts";

const s = serve({ port: 8000 });

console.log("http://localhost:8000/");

for await (const req of s) {
  const url = new URL(req.url, "https://0.0.0.0");

  if (url.pathname === "/oembed.json") {
    const username = url.searchParams.get("username");
    console.log(url.pathname, username);
    if (username != null) {
      try {
        const profile = await twitter.getProfile(username);
        const legacy = profile.user.legacy;

        console.log(profile, legacy);

        req.respond({
          body: JSON.stringify({
            thumbnail_url: legacy.profile_image_url_https,
            thumbnail_width: 73,
            thumbnail_height: 73,
            "author_name": `${legacy.name} (@${legacy.screen_name})`,
            "author_url": legacy.url ??
              `https://twitter.com/${legacy.screen_name}`,
            // "provider_name": "TwitFix",
            // "provider_url": "https://github.com/robinuniverse/twitfix",
            // "title": "rapparu",
            "type": "video",
            "version": "1.0",
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        });
      } catch (err: unknown) {
        console.error({ err });
        if (err instanceof Twitter.TwitterErrorList) {
          req.respond({
            body: err.message,
            status: 502,
          });
        }
      }
    }
    continue;
  }

  const id = parseTwitterPath(req.url);

  if (id) {
    const tweet = await twitter.getTweet(id);
    // const tweet: Twitter.Tweet = await Deno.readTextFile('./example.json').then(text => JSON.parse(text))
    const video = Twitter.getVideos(tweet)?.[0];

    if (video) {
      const videoInfo = Twitter.getVideoInfo(video);
      const username = video.expanded_url.split("/")[3];

      console.log(username);

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
        `<meta property="og:${k}" content="${v}"/>`
      ).join("");
      const twtMeta = Object.entries(twitterMeta).map(([k, v]) =>
        `<meta property="${k}" content="${v}"/>`
      ).join("");

      req.respond({
        body: `
        <html>
          <title></title>
          <meta name="theme-color" content="#1da0f2" />
          <meta charset="utf-8"/>
          ${twtMeta}
          ${ogpMeta}
          <link rel="alternate" href="https://4ee989f15a4c.ngrok.io/oembed.json?username=${username}" type="application/json+oembed" title="rapparu">
        </html>`,
        headers: new Headers({ "Content-Type": "text/html" }),
      });
      continue;
    }
  }

  req.respond({ status: 204 });
}
