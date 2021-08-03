// deno-lint-ignore-file

// twitter guest web token
// https://github.com/ytdl-org/youtube-dl/blob/2021.05.16/youtube_dl/extractor/twitter.py#L84
const TWITTER_BEARER_TOKEN =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

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
  /** The URL to the video source */
  url: string;
  /** The bitrate of the video */
  bitrate?: number;
  content_type: string;
}

export interface EntitySize {
  w: number;
  h: number;
  resize: "crop" | "fit" | string;
}

export interface Entity {
  type: string;

  id: number;
  id_str: string;
  indices: number[]; // unknown

  original_info: {
    width: number;
    height: number;
  };

  sizes: {
    thumb: EntitySize;
    small: EntitySize;
    medium: EntitySize;
    large: EntitySize;
  };

  /** A shortened url to the tweet */
  url: string;
  media_url: string;
  media_url_https: string;
  display_url: string;
  expanded_url: string;
}

export interface ExtendedVideoEntity extends Entity {
  type: "video" | "animated_gif";

  video_info: {
    aspect_ratio: [number, number];
    variants: VideoInfo[];
  };

  media_key: string;
}

export interface PhotoEntity extends Entity {
  type: "photo";
}

export type ExtendedMediaEntity =
  | ExtendedVideoEntity
  | PhotoEntity & unknown;

// just scaffolded for what's needed
export interface Tweet {
  created_at: string;
  id: number;
  id_str: string;
  full_text: string;
  truncated: boolean;
  display_text_range: [number, number];

  entities: {
    hashtags: unknown[];
    symbols: unknown[];
    user_mentions: unknown[];
    urls: unknown[];
    media: (PhotoEntity | Entity)[];
  };

  extended_entities?: {
    media: ExtendedMediaEntity[];
  };

  source: string;
  in_reply_to_status_id: number | null;
  in_reply_to_status_id_str: string | null;

  in_reply_to_user_id: number | null;
  in_reply_to_user_id_str: string | null;

  in_reply_to_screen_name: string | null;

  user_id: number;
  user_id_str: string;

  geo: unknown | null;
  coordinates: unknown | null;
  is_quote_status: boolean;

  retween_count: number;
  favorite_count: number;

  conversation_id: number;
  converstation_id_str: string;

  favorited: boolean;
  retweeted: boolean;

  possibly_sensitive: boolean;
  possibly_sensitive_editable: boolean;
  lang: string;
  supplemental_language: unknown | null;

  retweeted_status_id_str?: string;
  quoted_status_id_str?: string;
}

export interface UrlEntity {
  display_url: string;
  expanded_url: string;
  url: string;
  // tood
  indices: [number, number][];
}

interface ColorPart {
  percentage: number;
  rgb: {
    blue: number;
    green: number;
    red: number;
  };
}

type Palette = ColorPart[];

export interface MediaColor {
  r: {
    ok: {
      palette: Palette;
    };
  };
}

export interface Profile {
  user: {
    id: string;
    rest_id: string;
    affiliates_highlighted_label: Record<string, unknown>;
    legacy_extended_profile: Record<string, unknown>;
    is_profile_translatable: boolean;
    legacy: {
      created_at: string;
      default_profile: boolean;
      default_profile_image: boolean;
      description: string;
      // todo
      entities: {
        description: {
          urls: UrlEntity[];
        };
        url: {
          urls: UrlEntity[];
        };
      };
      fast_followers_count: number;
      favourites_count: number;
      followers_count: number;
      friends_count: number;
      has_custom_timelines: boolean;
      is_translator: boolean;
      listed_count: number;
      location: string;
      name: string;
      normal_followers_count: number;
      pinned_tweet_ids_str: string[];
      profile_banner_extensions: {
        mediaColor: MediaColor;
      };
      profile_banner_url: string;
      profile_image_extensions: {
        mediaColor: MediaColor;
      };
      profile_image_url_https: string;

      profile_interstitial_type: string;
      protected: boolean;
      screen_name: string;
      statuses_count: number;
      translator_type: string;
      /** short url to the profile */
      url?: string;
      verified: boolean;
      withheld_in_countries: string[];
    };
  };
}

export interface Conversation {
  globalObjects: {
    tweets: {
      [id: string]: Tweet;
    };
  };
}

export class GuestClient {
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

  async getProfile(username: string): Promise<Profile> {
    const apiUrl =
      `https://twitter.com/i/api/graphql/Vf8si2dfZ1zmah8ePYPjDQ/UserByScreenNameWithoutResults?variables=${
        encodeURIComponent(JSON.stringify({
          "screen_name": username,
          "withHighlightedLabel": true,
        }))
      }`;

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
        return res.data;
      });
  }

  async getTweet(id: string) {
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
      });
  }
}

export function getVideos(tweet: Tweet) {
  const videoEntities = tweet.extended_entities?.media
    .filter((m): m is ExtendedVideoEntity =>
      m.type === "video" || m.type === "animated_gif"
    );

  return videoEntities;
}

/** Gets information on the highest quality video  */
export function getVideoInfo(entity: ExtendedVideoEntity) {
  return entity.video_info.variants
    .filter((v) => v.bitrate != null)
    .sort((a, b) => b.bitrate! - a.bitrate!)
    ?.[0] as Required<VideoInfo>;
}
