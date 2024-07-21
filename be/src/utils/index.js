import path from "path";
import fs from "fs/promises";
import fetch from "node-fetch";
import childProces from "child_process";

import {
  GOOGLE_DOC_URL,
  GOOGLE_DOC_CREATE_URL,
  GOOGLE_OAUTH_URL,
} from "../constants/index.js";
import { environment } from "../environment/index.js";

const initializeBatchUpdateRequest = (
  currentHeaderTitle,
  startIndex,
  selectionText,
  source,
) => {
  const today = new Date().toDateString().substr(4);
  const headerTitle = "\n" + today;

  const obj = {
    requests: [],
  };

  if (!currentHeaderTitle) {
    obj.requests.push(
      {
        insertText: {
          text: "\n\n" + headerTitle,
          location: {
            segmentId: "",
            index: startIndex - 1,
          },
        },
      },
      {
        updateParagraphStyle: {
          paragraphStyle: {
            namedStyleType: "HEADING_1",
          },
          fields: "*",
          range: {
            startIndex: startIndex,
            endIndex: startIndex - 1 + headerTitle.length,
          },
        },
      },
    );
    startIndex = startIndex + headerTitle.length;
  } else if (currentHeaderTitle !== today) {
    obj.requests.push(
      {
        insertText: {
          text: headerTitle,
          location: {
            segmentId: "",
            index: startIndex - 1,
          },
        },
      },
      {
        updateParagraphStyle: {
          paragraphStyle: {
            namedStyleType: "HEADING_1",
          },
          fields: "*",
          range: {
            startIndex: startIndex,
            endIndex: startIndex - 1 + headerTitle.length,
          },
        },
      },
      {
        deleteParagraphBullets: {
          range: {
            segmentId: "",
            startIndex: startIndex,
            endIndex: startIndex - 1 + headerTitle.length,
          },
        },
      },
    );
    startIndex = startIndex + headerTitle.length;
  }

  if (selectionText.length > 0) {
    const content = "\n" + selectionText;
    obj.requests.push(
      {
        insertText: {
          text: content,
          location: {
            segmentId: "",
            index: startIndex - 1,
          },
        },
      },
      {
        createParagraphBullets: {
          range: {
            segmentId: "",
            startIndex: startIndex,
            endIndex: startIndex - 1 + content.length,
          },
          bulletPreset: "BULLET_ARROW_DIAMOND_DISC",
        },
      },
      {
        updateParagraphStyle: {
          paragraphStyle: {
            namedStyleType: "NORMAL_TEXT",
          },
          fields: "*",
          range: {
            startIndex: startIndex,
            endIndex: startIndex - 1 + content.length,
          },
        },
      },
    );
  }

  return obj;
};

const getAccessToken = async (refreshToken) => {
  const CLIENT_ID = environment.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = environment.GOOGLE_CLIENT_SECRET;

  const body = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };

  const res = await makeRequest(GOOGLE_OAUTH_URL, "POST", body);

  return res;
};

export const createDoc = async (token, userData, userId, docName, redis) => {
  const body = {
    title: docName,
  };

  const doc = await makeRequest(`${GOOGLE_DOC_CREATE_URL}`, "POST", body, {
    authorization: `Bearer ${token}`,
  });

  if (doc.error) {
    if (doc.error.code === 403) {
      return {
        error: "Scope is not defined",
        code: "SCOPE_NOT_DEFINED",
        status: 403,
      };
    }

    return {
      error: "Server Error",
      code: "OTHER_ERROR",
      status: 500,
    };
  }

  const res = await makeRequest(
    `${GOOGLE_DOC_CREATE_URL}/${doc.documentId}:batchUpdate`,
    "POST",
    {
      requests: [
        {
          insertText: {
            text: docName,
            location: {
              segmentId: "",
              index: 1,
            },
          },
        },
        {
          updateParagraphStyle: {
            paragraphStyle: {
              namedStyleType: "TITLE",
            },
            fields: "*",
            range: {
              startIndex: 1,
              endIndex: docName.length,
            },
          },
        },
      ],
    },
    {
      authorization: `Bearer ${token}`,
    },
  );

  if (res.error) {
    return {
      status: 500,
      error: "Server Error",
      code: "OTHER_ERROR",
    };
  }

  userData = {
    ...userData,
    docs: userData.docs.concat(doc).map((doc) => {
      return {
        title: doc.title,
        docUrl: `${GOOGLE_DOC_URL}/${doc.documentId}`,
        documentId: doc.documentId,
      };
    }),
  };

  await saveToRedis(userId, JSON.stringify(userData), redis);

  return userData.docs;
};

export const validateAndSetAccessToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).send({
      error: "Authorization header not found",
      code: "AUTH_CODE_NOT_FOUND",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  const response = await getAccessToken(token);
  if (response.error && response.error === "invalid_grant") {
    res.status(401);
    res.send({
      error: "Token Invalid",
      code: "EXPIRED",
    });
    return;
  }

  res.locals = {
    ...res.locals,
    token: response.access_token,
  };
  next();
};

export const getRedisData = async (key, redis) => {
  return await redis.get(key);
};

export const saveToRedis = async (key, value, redis) => {
  const exec = childProces.exec;
  await redis.set(key, value);
  return new Promise((res) => {
    exec(
      `redis-cli -h ${environment.HOST} -p 6380 --rdb /data/dump.rdb`,
      (err, stdout, stderr) => {
        if (err) {
          console.error(err);
        }
        res();
      },
    );
  });
};

export const getDetailsFromDoc = (doc) => {
  let currentHeaderTitle = "";

  if (!doc.body) {
    return {
      startIndex: -1,
      currentHeaderTitle,
    };
  }

  const startIndex = doc.body.content[doc.body.content.length - 1].endIndex;

  doc.body.content.forEach((content) => {
    if (content.paragraph && content.paragraph.paragraphStyle) {
      if (content.paragraph.paragraphStyle.namedStyleType === "HEADING_1") {
        currentHeaderTitle =
          content.paragraph.elements[0].textRun.content.split("\n")[0];
      }
    }
  });

  return {
    startIndex: startIndex,
    currentHeaderTitle,
  };
};

export const appendToDoc = async (token, docDetails) => {
  const { docId, startIndex, selectionText, sourceUrl, currentHeaderTitle } =
    docDetails;
  const body = initializeBatchUpdateRequest(
    currentHeaderTitle,
    startIndex,
    selectionText,
    sourceUrl,
  );
  console.log(body);

  try {
    const res = await makeRequest(
      `${GOOGLE_DOC_CREATE_URL}/${docId}:batchUpdate`,
      "POST",
      body,
      {
        authorization: `Bearer ${token}`,
      },
    );
    console.log(res, "====RES==");

    return res;
  } catch (e) {
    console.log(e);
  }
};

export const getDocFromGoogle = async (token, docId) => {
  const res = await makeRequest(
    `${GOOGLE_DOC_CREATE_URL}/${docId}`,
    "GET",
    null,
    {
      Authorization: `Bearer ${token}`,
    },
  );

  return res;
};

export const getUserInfo = async (userId, redis) => {
  const userData = JSON.parse(await getRedisData(userId, redis));

  return userData;
};

export const getGoogleAuthToken = async (authCode) => {
  const CLIENT_SECRET = environment.GOOGLE_CLIENT_SECRET;
  const CLIENT_ID = environment.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = environment.REDIRECT_URI;

  const body = {
    code: authCode,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  };

  const res = await makeRequest(GOOGLE_OAUTH_URL, "POST", body);

  return res;
};

export const getUserInfoFromGoogle = async (tokenResponse) => {
  const { access_token } = tokenResponse;

  const res = await makeRequest(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    "GET",
    null,
    {
      Authorization: `Bearer ${access_token}`,
    },
  );

  return res;
};

const makeRequest = async (url, method, body, headers) => {
  const res = await fetch(url, {
    method: method,
    ...(body && { body: JSON.stringify(body) }),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  return await res.json();
};
