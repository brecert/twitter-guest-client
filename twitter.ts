// deno-lint-ignore-file

// twitter guest web token
// https://github.com/ytdl-org/youtube-dl/blob/2021.05.16/youtube_dl/extractor/twitter.py#L84
const TWITTER_BEARER_TOKEN =
  "Bearer AAAAAAAAAAAAAAAAAAAAAPYXBAAAAAAACLXUNDekMxqa8h%2F40K4moUkGsoc%3DTYfbDKbT3jJPCEVnMYqilB28NHfOPqkca3qaAxGfsyKCs0wRbw";

const TWITTER_API_URL = "https://api.twitter.com/1.1/guest/activate.json";

export class TwitterError extends Error {
  code: number;

  constructor({ message, code }: { message: string; code: number }) {
    super(message);
    this.code = code;
  }
}

export class TwitterErrorList extends Error {
  constructor(public errors: TwitterError[]) {
    super(errors.map((err) => err.message).join("\n\n"));
  }
}

export interface VideoInfo {
  url: string;
  bitrate?: number;
  content_type: string;
}

// just scaffolded for what's needed
export interface Tweet {
  extended_entities?: {
    media?: {
      type: "video" | string;
      video_info: {
        variants: VideoInfo[];
      };
    }[];
  };

  retweeted_status_id_str?: string;
  quoted_status_id_str?: string;
}

export interface Conversation {
  globalObjects: {
    tweets: {
      [id: string]: Tweet;
    };
  };
}

export class TwitterClient {
  guestToken?: string;

  constructor(public userAgent: string) {}

  fetchGuestToken() {
    return fetch(TWITTER_API_URL, {
      method: "post",
      headers: {
        "user-agent": this.userAgent,
        authorization: TWITTER_BEARER_TOKEN,
      },
    }).then((res) => res.json());
  }

  async getGuestToken() {
    if (!this.guestToken) {
      const data = await this.fetchGuestToken();
      this.guestToken = data["guest_token"];
    }
    return this.guestToken!;
  }

  async getVideos(id: string) {
    const apiUrl =
      `https://api.twitter.com/2/timeline/conversation/${id}.json?tweet_mode=extended`;

    return fetch(apiUrl, {
      headers: {
        "user-agent": this.userAgent,
        "authorization": TWITTER_BEARER_TOKEN,
        "x-guest-token": await this.getGuestToken(),
      },
    }).then((res) => res.json())
      .then((res) => {
        if (res.errors) {
          throw new TwitterErrorList(
            res.errors.map((err: any) => new TwitterError(err)),
          );
        }
        return res;
      })
      .then((conversation: Conversation) => {
        const tweets = conversation.globalObjects.tweets;
        return tweets[
          tweets[id].retweeted_status_id_str ??
            tweets[id].quoted_status_id_str ?? id
        ];
      })
      .then((tweet) =>
        tweet.extended_entities?.media
          ?.filter((m) => m.type === "video")
          .flatMap((entity) =>
            entity.video_info.variants
              .filter((v) => v.bitrate)
              .sort((a, b) => a.bitrate! - b.bitrate!)
              ?.[0] as Required<VideoInfo>
          )
      )
      .then((info) => info ? info.length > 0 ? info : null : null);
  }
}
