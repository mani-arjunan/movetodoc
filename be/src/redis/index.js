import redis from "redis";

export class Redis {
  static _client;

  async initialize() {
    const client = redis.createClient({
      socket: {
        port: 6380,
        host: "192.168.0.111",
      },
    });

    try {
      await client.connect();
    } catch (e) {
      console.error(e);
    }

    return client;
  }

  static shutdown() {
    return new Promise((resolve, reject) => {
      if (this._client) {
        this._client.quit();
        resolve();
      } else {
        reject("Redis client not initialized");
      }
    });
  }

  static async client() {
    if (!this._client) {
      this._client = await new Redis().initialize();
    }
    return this._client;
  }
}
